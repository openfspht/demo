import { describe, expect, test } from "bun:test"
import {
    ApiError,
    InvalidRequestError,
    Money,
    Payment,
    PaymentEvent,
    type PaymentEventType,
    type PaymentStatus,
} from "@openfsp/sdk"

import { catalog } from "../domain/catalog"
import { InMemoryOrders, InMemoryProcessedEvents } from "../infrastructure/adapters"
import { Checkout, InvalidOrder } from "./checkout"
import type { Authenticity, PaymentApi, WebhookAuthenticity } from "./ports"
import { WebhookReceiver } from "./webhook-receiver"

const clock = { now: () => new Date("2026-11-09T15:00:00Z") }

const SESSION = "0b0c3f52-1c43-4d5e-9a3b-6f1e2d7c8a90"

const retention = { capacity: 100, maxAgeMs: 86_400_000, clock }

function payment(status: PaymentStatus = "pending", reference = "SHOP-1"): Payment {
    return new Payment({
        id: "pay_1",
        reference,
        status,
        amount: Money.htg(1250),
        provider: "mock_alpha",
        nextAction: { type: "payer_approval" },
        createdAt: new Date("2026-11-09T15:00:00Z"),
        updatedAt: new Date("2026-11-09T15:00:00Z"),
        metadata: {},
    })
}

const paymentApi: PaymentApi = {
    createPayment: async () => payment(),
    getPayment: async () => payment("succeeded"),
    findPayment: async () => undefined,
    providers: async () => [
        { id: "mock_alpha", displayName: "Alpha (mock)" },
        { id: "mock_beta", displayName: "Beta (mock)" },
    ],
}

function event(
    sequence: number,
    status: PaymentStatus,
    reference: string,
    id = `evt_${sequence}`
): PaymentEvent {
    return new PaymentEvent({
        id,
        type: status === "pending" ? "payment.created" : (`payment.${status}` as PaymentEventType),
        sequence,
        createdAt: new Date("2026-11-09T15:00:00Z"),
        payment: payment(status, reference),
    })
}

function delivery(): Request {
    return new Request("https://shop.example/webhooks/openfsp", {
        method: "POST",
    })
}

class ScriptedAuthenticity implements WebhookAuthenticity {
    next: Authenticity = { verified: false, reason: "unsigned" }

    async verify(): Promise<Authenticity> {
        return this.next
    }
}

function setUp(api: PaymentApi = paymentApi) {
    const orders = new InMemoryOrders(retention)
    const checkout = new Checkout(catalog, api, orders, clock, {
        providers: ["mock_alpha"],
        publicUrl: "https://shop.example",
    })
    const authenticity = new ScriptedAuthenticity()
    const receiver = new WebhookReceiver(
        authenticity,
        orders,
        new InMemoryProcessedEvents(retention),
        api,
        clock
    )
    const deliver = async (verified: PaymentEvent) => {
        authenticity.next = { verified: true, event: verified }
        return receiver.receive(delivery())
    }
    return { orders, checkout, authenticity, receiver, deliver }
}

describe("checkout", () => {
    test("offers the providers of the server, narrowed by the configuration", async () => {
        const { checkout } = setUp()
        expect(await checkout.providers()).toEqual([
            { id: "mock_alpha", name: "Alpha (mock)", logo_url: null },
        ])
        const open = new Checkout(catalog, paymentApi, new InMemoryOrders(retention), clock, {
            publicUrl: "https://shop.example",
        })
        expect((await open.providers()).map((provider) => provider.id)).toEqual([
            "mock_alpha",
            "mock_beta",
        ])
    })

    test("places an order for a known product and provider", async () => {
        const { checkout } = setUp()
        const order = await checkout.place(
            SESSION,
            [
                { product_id: "coffee", quantity: 2 },
                { product_id: "mangoes", quantity: 1 },
            ],
            "+50934567890",
            "mock_alpha"
        )
        expect(order.status).toBe("pending")
        expect(order.amount).toEqual({ amount: 82_500, currency: "HTG" })
        expect(order.lines.map((line) => line.quantity)).toEqual([2, 1])
        expect(checkout.list(SESSION, 0, 12).orders).toHaveLength(1)
    })

    test("sends an eight-digit phone number to the server in E.164", async () => {
        let sent: string | undefined
        const recording: PaymentApi = {
            ...paymentApi,
            createPayment: async (request) => {
                sent = request.payerPhoneNumber
                return payment()
            },
        }
        const checkout = new Checkout(catalog, recording, new InMemoryOrders(retention), clock, {
            publicUrl: "https://shop.example",
        })
        await checkout.place(
            SESSION,
            [{ product_id: "coffee", quantity: 1 }],
            "3456 7890",
            "mock_alpha"
        )
        expect(sent).toBe("+50934567890")
    })

    test("refuses an empty cart or a quantity out of range", async () => {
        const { checkout } = setUp()
        expect(checkout.place(SESSION, [], "", "mock_alpha")).rejects.toBeInstanceOf(InvalidOrder)
        expect(
            checkout.place(SESSION, [{ product_id: "coffee", quantity: 21 }], "", "mock_alpha")
        ).rejects.toBeInstanceOf(InvalidOrder)
    })

    test("refuses a phone number that is not E.164 before saving or calling the server", async () => {
        let calls = 0
        const { checkout, orders } = setUp({
            ...paymentApi,
            createPayment: async () => {
                calls += 1
                return payment()
            },
        })
        for (const phone of ["1234", "+509 abc", "0050934567890"]) {
            await expect(
                checkout.place(
                    SESSION,
                    [{ product_id: "coffee", quantity: 1 }],
                    phone,
                    "mock_alpha"
                )
            ).rejects.toMatchObject({ code: "invalid-phone" })
        }
        expect(calls).toBe(0)
        expect(orders.ofSession(SESSION, 0, 100).orders).toHaveLength(0)
    })

    test("forgets the order when the SDK refuses the request before sending it", async () => {
        const { checkout, orders } = setUp({
            ...paymentApi,
            createPayment: async () => {
                throw new InvalidRequestError("payerPhoneNumber must be in E.164 format")
            },
        })
        await expect(
            checkout.place(SESSION, [{ product_id: "coffee", quantity: 1 }], "", "mock_alpha")
        ).rejects.toMatchObject({ code: "rejected-request" })
        expect(orders.ofSession(SESSION, 0, 100).orders).toHaveLength(0)
    })

    test("refuses an unknown provider", async () => {
        const { checkout } = setUp()
        expect(
            checkout.place(
                SESSION,
                [{ product_id: "coffee", quantity: 1 }],
                "+50934567890",
                "moncash"
            )
        ).rejects.toBeInstanceOf(InvalidOrder)
    })

    test("gives orders placed at the same instant distinct readable references", async () => {
        const { checkout } = setUp()
        const place = () =>
            checkout.place(SESSION, [{ product_id: "coffee", quantity: 1 }], "", "mock_alpha")
        const references = [(await place()).reference, (await place()).reference]
        expect(new Set(references).size).toBe(2)
        for (const reference of references) {
            expect(reference).toMatch(/^SHOP-[0-9A-F]{12}$/)
        }
    })

    test("saves the order with its idempotency key before calling the server", async () => {
        let seen: { key: string; saved?: string } | undefined
        const { checkout, orders } = setUp({
            ...paymentApi,
            createPayment: async (request, idempotencyKey) => {
                seen = {
                    key: idempotencyKey,
                    saved: orders.find(request.reference)?.idempotency_key,
                }
                return payment("pending", request.reference)
            },
        })
        const order = await checkout.place(
            SESSION,
            [{ product_id: "coffee", quantity: 1 }],
            "",
            "mock_alpha"
        )
        expect(seen?.saved).toBe(seen?.key)
        expect(order.idempotency_key).toBe(seen!.key)
        expect(order.payment_id).toBe("pay_1")
    })

    test("forgets an order the paymentApi refused without effect and keeps one whose outcome is unknown", async () => {
        let effect: "none" | "unknown" = "none"
        let found: Payment | undefined = undefined
        const { checkout, orders } = setUp({
            ...paymentApi,
            createPayment: async () => {
                throw new ApiError({
                    status: effect === "none" ? 422 : 502,
                    code: "provider-error",
                    title: "Refused",
                    retryable: false,
                    effect,
                })
            },
            findPayment: async () => found,
            getPayment: async () => payment("succeeded"),
        })
        const place = () =>
            checkout.place(SESSION, [{ product_id: "coffee", quantity: 1 }], "", "mock_alpha")
        await expect(place()).rejects.toBeInstanceOf(ApiError)
        expect(orders.ofSession(SESSION, 0, 100).orders).toHaveLength(0)

        effect = "unknown"
        await expect(place()).rejects.toBeInstanceOf(ApiError)
        const [kept] = orders.ofSession(SESSION, 0, 100).orders
        expect(kept?.payment_id).toBeUndefined()
        expect((await checkout.read(kept!.reference)).status).toBe("pending")
        found = payment("succeeded", kept!.reference)
        const resolved = await checkout.read(kept!.reference)
        expect(resolved).toMatchObject({ status: "succeeded", payment_id: "pay_1" })
    })

    test("reads the order status from the paymentApi on return", async () => {
        const { checkout } = setUp()
        const order = await checkout.place(
            SESSION,
            [
                { product_id: "coffee", quantity: 2 },
                { product_id: "mangoes", quantity: 1 },
            ],
            "+50934567890",
            "mock_alpha"
        )
        expect((await checkout.read(order.reference)).status).toBe("succeeded")
    })
})

describe("webhook receiver", () => {
    test("rejects an unverified delivery", async () => {
        const { receiver } = setUp()
        expect(await receiver.receive(delivery())).toEqual({
            accepted: false,
            reason: "unsigned",
        })
    })

    test("applies events in sequence, ignores duplicates and stale ones, and never leaves a terminal state", async () => {
        const { checkout, deliver, orders } = setUp()
        const { reference } = await checkout.place(
            SESSION,
            [{ product_id: "coffee", quantity: 1 }],
            "+50934567890",
            "mock_alpha"
        )
        expect(
            (await deliver(event(2, "succeeded", reference))).accepted &&
                orders.find(reference)?.status
        ).toBe("succeeded")
        expect(await deliver(event(2, "succeeded", reference))).toMatchObject({
            outcome: "duplicate",
        })
        expect(await deliver(event(1, "pending", reference))).toMatchObject({
            outcome: "stale",
        })
        expect(await deliver(event(3, "failed", reference))).toMatchObject({
            outcome: "terminal",
        })
        expect(orders.find(reference)?.status).toBe("succeeded")
    })

    test("re-reads the payment from the paymentApi instead of leaving a terminal state", async () => {
        const reads: string[] = []
        const { checkout, deliver, orders } = setUp({
            ...paymentApi,
            getPayment: async (id) => {
                reads.push(id)
                return payment("succeeded")
            },
        })
        const { reference } = await checkout.place(
            SESSION,
            [{ product_id: "coffee", quantity: 1 }],
            "+50934567890",
            "mock_alpha"
        )
        await deliver(event(1, "pending", reference))
        await deliver(event(2, "succeeded", reference))
        expect(reads).toEqual([])
        expect(await deliver(event(3, "failed", reference))).toMatchObject({
            outcome: "terminal",
        })
        expect(reads).toEqual(["pay_1"])
        expect(orders.find(reference)?.status).toBe("succeeded")
    })

    test("re-reads the payment from the paymentApi when the sequence skips ahead", async () => {
        const reads: string[] = []
        const { checkout, deliver, orders } = setUp({
            ...paymentApi,
            getPayment: async (id) => {
                reads.push(id)
                return payment("expired")
            },
        })
        const { reference } = await checkout.place(
            SESSION,
            [{ product_id: "coffee", quantity: 1 }],
            "+50934567890",
            "mock_alpha"
        )
        await deliver(event(1, "pending", reference))
        expect(await deliver(event(3, "failed", reference))).toMatchObject({
            outcome: "gap",
        })
        expect(reads).toEqual(["pay_1"])
        expect(orders.find(reference)?.status).toBe("expired")
        expect(await deliver(event(2, "succeeded", reference))).toMatchObject({
            outcome: "stale",
        })
    })

    test("applies an event delivered before the paymentApi answers the creation", async () => {
        let early: Awaited<ReturnType<WebhookReceiver["receive"]>> | undefined
        const context: {
            deliver?: (event: PaymentEvent) => ReturnType<WebhookReceiver["receive"]>
        } = {}
        const { checkout, deliver, orders } = setUp({
            ...paymentApi,
            createPayment: async (request) => {
                early = await context.deliver!(event(1, "succeeded", request.reference))
                return payment("pending", request.reference)
            },
        })
        context.deliver = deliver
        const order = await checkout.place(
            SESSION,
            [{ product_id: "coffee", quantity: 1 }],
            "",
            "mock_alpha"
        )
        expect(early).toMatchObject({ accepted: true, outcome: "applied" })
        expect(order).toMatchObject({ status: "succeeded", payment_id: "pay_1" })
        expect(orders.find(order.reference)?.events).toHaveLength(1)
    })

    test("remembers an event only once it has been applied", async () => {
        let serverDown = true
        const { checkout, deliver, orders } = setUp({
            ...paymentApi,
            getPayment: async () => {
                if (serverDown) {
                    throw new Error("paymentApi unavailable")
                }
                return payment("succeeded")
            },
        })
        const { reference } = await checkout.place(
            SESSION,
            [{ product_id: "coffee", quantity: 1 }],
            "+50934567890",
            "mock_alpha"
        )
        await expect(deliver(event(2, "succeeded", reference))).rejects.toThrow(
            "paymentApi unavailable"
        )
        serverDown = false
        expect(await deliver(event(2, "succeeded", reference))).toMatchObject({
            outcome: "gap",
        })
        expect(orders.find(reference)?.status).toBe("succeeded")
    })
})

function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((settle) => {
        resolve = settle
    })
    return { promise, resolve }
}

function heldReads() {
    const pending: ReturnType<typeof deferred<Payment>>[] = []
    let asked = deferred<void>()
    return {
        pending,
        nextCall: () => asked.promise,
        getPayment: () => {
            const answer = deferred<Payment>()
            pending.push(answer)
            asked.resolve()
            asked = deferred<void>()
            return answer.promise
        },
    }
}

describe("concurrent writes on one order", () => {
    test("a read answered after a webhook keeps the webhook's terminal status and event", async () => {
        const reads = heldReads()
        const { checkout, deliver, orders } = setUp({ ...paymentApi, getPayment: reads.getPayment })
        const { reference } = await checkout.place(
            SESSION,
            [{ product_id: "coffee", quantity: 1 }],
            "",
            "mock_alpha"
        )
        const reading = checkout.read(reference)
        expect(await deliver(event(1, "succeeded", reference))).toMatchObject({
            outcome: "applied",
        })
        reads.pending[0]!.resolve(payment("pending", reference))

        expect(await reading).toMatchObject({ status: "succeeded" })
        expect(orders.find(reference)).toMatchObject({ status: "succeeded" })
        expect(orders.find(reference)?.events.map((it) => it.id)).toEqual(["evt_1"])
    })

    test("a webhook resynchronised after a read keeps the read's terminal status", async () => {
        const reads = heldReads()
        const { checkout, deliver, orders } = setUp({ ...paymentApi, getPayment: reads.getPayment })
        const { reference } = await checkout.place(
            SESSION,
            [{ product_id: "coffee", quantity: 1 }],
            "",
            "mock_alpha"
        )
        const delivering = deliver(event(2, "succeeded", reference))
        await reads.nextCall()
        const reading = checkout.read(reference)
        reads.pending[1]!.resolve(payment("succeeded", reference))
        expect(await reading).toMatchObject({ status: "succeeded" })
        reads.pending[0]!.resolve(payment("pending", reference))

        expect(await delivering).toMatchObject({ outcome: "gap" })
        expect(orders.find(reference)).toMatchObject({ status: "succeeded" })
        expect(orders.find(reference)?.events.map((it) => it.id)).toEqual(["evt_2"])
    })

    test("a webhook resynchronised after another event keeps both events", async () => {
        const reads = heldReads()
        const { checkout, deliver, orders } = setUp({ ...paymentApi, getPayment: reads.getPayment })
        const { reference } = await checkout.place(
            SESSION,
            [{ product_id: "coffee", quantity: 1 }],
            "",
            "mock_alpha"
        )
        const delivering = deliver(event(3, "failed", reference))
        await reads.nextCall()
        expect(await deliver(event(1, "pending", reference))).toMatchObject({
            outcome: "applied",
        })
        reads.pending[0]!.resolve(payment("failed", reference))

        expect(await delivering).toMatchObject({ outcome: "gap" })
        expect(orders.find(reference)).toMatchObject({ status: "failed" })
        expect(orders.find(reference)?.events.map((it) => it.id)).toEqual(["evt_1", "evt_3"])
    })
})
