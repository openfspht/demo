import { afterAll, describe, expect, test } from "bun:test"
import { Money, Payment } from "@openfsp/sdk"

import { Checkout } from "../application/checkout"
import type { PaymentApi, WebhookAuthenticity } from "../application/ports"
import { WebhookReceiver } from "../application/webhook-receiver"
import { catalog } from "../domain/catalog"
import { InMemoryOrders, InMemoryProcessedEvents } from "../infrastructure/adapters"
import { routes } from "./routes"

const clock = { now: () => new Date("2026-11-09T15:00:00Z") }

const SESSION = "0b0c3f52-1c43-4d5e-9a3b-6f1e2d7c8a90"

const retention = { capacity: 100, maxAgeMs: 86_400_000, clock }

const paymentApi: PaymentApi = {
    createPayment: async (request) =>
        new Payment({
            id: `pay_${request.reference}`,
            reference: request.reference,
            status: "pending",
            amount: Money.htg(1250),
            provider: "mock_alpha",
            nextAction: { type: "payer_approval" },
            createdAt: clock.now(),
            updatedAt: clock.now(),
            metadata: {},
        }),
    getPayment: async (id) =>
        new Payment({
            id,
            reference: id.replace("pay_", ""),
            status: "pending",
            amount: Money.htg(350),
            provider: "mock_alpha",
            nextAction: { type: "payer_approval" },
            createdAt: clock.now(),
            updatedAt: clock.now(),
            metadata: {},
        }),
    findPayment: async () => undefined,
    providers: async () => [{ id: "mock_alpha", displayName: "Alpha (mock)" }],
}

const unsigned: WebhookAuthenticity = {
    verify: async () => ({ verified: false, reason: "unsigned" }),
}

const orders = new InMemoryOrders(retention)
const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    routes: routes(
        new Checkout(catalog, paymentApi, orders, clock, {
            publicUrl: "https://shop.example",
        }),
        new WebhookReceiver(
            unsigned,
            orders,
            new InMemoryProcessedEvents(retention),
            paymentApi,
            clock
        )
    ),
})
afterAll(() => server.stop(true))

const place = (cookie?: string) =>
    fetch(new URL("/api/orders", server.url), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(cookie ? { Cookie: cookie } : {}),
        },
        body: JSON.stringify({
            attempt_id: crypto.randomUUID(),
            lines: [{ product_id: "coffee", quantity: 1 }],
            provider: "mock_alpha",
        }),
    })

const listed = async (cookie?: string) => {
    const response = await fetch(new URL("/api/orders", server.url), {
        headers: cookie ? { Cookie: cookie } : {},
    })
    return ((await response.json()) as { data: { reference: string }[] }).data.map(
        (order) => order.reference
    )
}

describe("orders", () => {
    test("lists only the orders placed by the same browser", async () => {
        const first = await place()
        const cookie = first.headers.get("Set-Cookie")?.split(";")[0]
        expect(first.headers.get("Set-Cookie")).toContain("HttpOnly")
        const own = ((await first.json()) as { reference: string }).reference
        const again = await place(cookie)
        expect(again.headers.get("Set-Cookie")).toBeNull()
        const second = ((await again.json()) as { reference: string }).reference
        await place()

        expect((await listed(cookie)).sort()).toEqual([own, second].sort())
        expect(await listed()).toEqual([])
        expect(await listed("shop_session=guessed")).toEqual([])
    })
})

describe("purchase attempts", () => {
    test("the catalog opens the session, so a resubmitted purchase finds its order", async () => {
        const catalog = await fetch(new URL("/api/products", server.url))
        const cookie = catalog.headers.get("Set-Cookie")?.split(";")[0]
        expect(cookie).toStartWith("shop_session=")
        const body = JSON.stringify({
            attempt_id: crypto.randomUUID(),
            lines: [{ product_id: "coffee", quantity: 1 }],
            provider: "mock_alpha",
        })
        const submit = () =>
            fetch(new URL("/api/orders", server.url), {
                method: "POST",
                headers: { "Content-Type": "application/json", Cookie: cookie! },
                body,
            })
        const first = (await (await submit()).json()) as { reference: string }
        const again = (await (await submit()).json()) as { reference: string }

        expect(again.reference).toBe(first.reference)
        expect(await listed(cookie)).toEqual([first.reference])
    })
})

describe("order responses", () => {
    const PUBLIC_FIELDS = [
        "amount",
        "created_at",
        "events",
        "lines",
        "next_action",
        "provider",
        "reference",
        "status",
    ]

    test("carry only the public fields of an order", async () => {
        const created = (await (await place()).json()) as Record<string, unknown>
        expect(Object.keys(created).sort()).toEqual(PUBLIC_FIELDS)

        const read = await fetch(new URL(`/api/orders/${String(created.reference)}`, server.url))
        expect(read.status).toBe(200)
        expect(Object.keys((await read.json()) as object).sort()).toEqual(PUBLIC_FIELDS)
    })

    test("serve an order by its reference to a browser without the session, as a bearer link", async () => {
        const { reference } = (await (await place()).json()) as { reference: string }
        const read = await fetch(new URL(`/api/orders/${reference}`, server.url), {
            headers: { Cookie: "shop_session=other" },
        })
        expect(read.status).toBe(200)
        expect(await read.json()).toMatchObject({ reference })
    })
})

describe("order requests", () => {
    const post = (body: string) =>
        fetch(new URL("/api/orders", server.url), {
            method: "POST",
            headers: { "Content-Type": "application/json", Cookie: `shop_session=${SESSION}` },
            body,
        })

    const ATTEMPT = "5d2f6a1e-8c3b-4e7a-9f10-2b4c6d8e0a12"

    test.each([
        ["malformed JSON", "{lines:", "invalid-body"],
        ["an array body", "[]", "invalid-body"],
        [
            "a missing attempt",
            JSON.stringify({
                lines: [{ product_id: "coffee", quantity: 1 }],
                provider: "mock_alpha",
            }),
            "invalid-body",
        ],
        [
            "an attempt that is not a random UUID",
            JSON.stringify({
                attempt_id: "1",
                lines: [{ product_id: "coffee", quantity: 1 }],
                provider: "mock_alpha",
            }),
            "invalid-body",
        ],
        [
            "lines that are not an array",
            JSON.stringify({ attempt_id: ATTEMPT, lines: "coffee", provider: "mock_alpha" }),
            "invalid-body",
        ],
        [
            "a provider that is not a string",
            JSON.stringify({ attempt_id: ATTEMPT, lines: [], provider: 1 }),
            "invalid-body",
        ],
        [
            "a phone number that is not a string",
            JSON.stringify({
                attempt_id: ATTEMPT,
                lines: [{ product_id: "coffee", quantity: 1 }],
                provider: "mock_alpha",
                phone_number: 509,
            }),
            "invalid-body",
        ],
        [
            "a line that is not an object",
            JSON.stringify({ attempt_id: ATTEMPT, lines: ["coffee"], provider: "mock_alpha" }),
            "invalid-line",
        ],
        [
            "a quantity that is not a number",
            JSON.stringify({
                attempt_id: ATTEMPT,
                lines: [{ product_id: "coffee", quantity: "2" }],
                provider: "mock_alpha",
            }),
            "invalid-line",
        ],
        [
            "a phone number that is not E.164",
            JSON.stringify({
                attempt_id: ATTEMPT,
                lines: [{ product_id: "coffee", quantity: 1 }],
                provider: "mock_alpha",
                phone_number: "1234",
            }),
            "invalid-phone",
        ],
    ])("answers 400 to %s without keeping an order", async (_, body, code) => {
        const before = orders.ofSession(SESSION, 0, 100).orders.length
        const response = await post(body)
        expect(response.status).toBe(400)
        expect(await response.json()).toMatchObject({ code })
        expect(orders.ofSession(SESSION, 0, 100).orders).toHaveLength(before)
    })
})
