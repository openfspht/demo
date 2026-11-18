import { afterAll, describe, expect, test } from "bun:test"
import { Money, Payment } from "@openfsp/sdk"

import { Checkout } from "../application/checkout"
import type { PaymentApi, WebhookAuthenticity } from "../application/ports"
import { WebhookReceiver } from "../application/webhook-receiver"
import { catalog } from "../domain/catalog"
import { InMemoryOrders, InMemoryProcessedEvents } from "../infrastructure/adapters"
import { routes } from "./routes"

const clock = { now: () => new Date("2026-11-09T15:00:00Z") }

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
    getPayment: async () => {
        throw new Error("not used")
    },
    findPayment: async () => undefined,
    providers: async () => [{ id: "mock_alpha", displayName: "Alpha (mock)" }],
}

const unsigned: WebhookAuthenticity = {
    verify: async () => ({ verified: false, reason: "unsigned" }),
}

const orders = new InMemoryOrders()
const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    routes: routes(
        new Checkout(catalog, paymentApi, orders, clock, {
            publicUrl: "https://shop.example",
        }),
        new WebhookReceiver(unsigned, orders, new InMemoryProcessedEvents(), paymentApi, clock)
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

describe("order requests", () => {
    const post = (body: string) =>
        fetch(new URL("/api/orders", server.url), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
        })

    test.each([
        ["malformed JSON", "{lines:", "invalid-body"],
        ["an array body", "[]", "invalid-body"],
        [
            "lines that are not an array",
            JSON.stringify({ lines: "coffee", provider: "mock_alpha" }),
            "invalid-body",
        ],
        [
            "a provider that is not a string",
            JSON.stringify({ lines: [], provider: 1 }),
            "invalid-body",
        ],
        [
            "a phone number that is not a string",
            JSON.stringify({
                lines: [{ product_id: "coffee", quantity: 1 }],
                provider: "mock_alpha",
                phone_number: 509,
            }),
            "invalid-body",
        ],
        [
            "a line that is not an object",
            JSON.stringify({ lines: ["coffee"], provider: "mock_alpha" }),
            "invalid-line",
        ],
        [
            "a quantity that is not a number",
            JSON.stringify({
                lines: [{ product_id: "coffee", quantity: "2" }],
                provider: "mock_alpha",
            }),
            "invalid-line",
        ],
        [
            "a phone number that is not E.164",
            JSON.stringify({
                lines: [{ product_id: "coffee", quantity: 1 }],
                provider: "mock_alpha",
                phone_number: "1234",
            }),
            "invalid-phone",
        ],
    ])("answers 400 to %s without keeping an order", async (_, body, code) => {
        const before = orders.all().length
        const response = await post(body)
        expect(response.status).toBe(400)
        expect(await response.json()).toMatchObject({ code })
        expect(orders.all()).toHaveLength(before)
    })
})
