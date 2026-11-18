import { describe, expect, test } from "bun:test"
import { OpenFsp } from "@openfsp/sdk"
import { FakeTransport, jsonResponse, wirePayment } from "@openfsp/sdk/testing"

import { syncWithPayment, type Order } from "../domain/order"
import { toOrderView } from "./order-view"

const placed: Order = {
    reference: "INV-184",
    lines: [],
    amount: { amount: 125_000, currency: "HTG" },
    idempotency_key: "key",
    provider: "moncash",
    status: "pending",
    created_at: "2026-11-15T12:00:00Z",
    events: [],
    version: 0,
}

async function viewOf(wire: ReturnType<typeof wirePayment>) {
    const openfsp = new OpenFsp(
        { baseUrl: "https://openfsp.example", apiKey: "key" },
        { transport: new FakeTransport(jsonResponse(200, wire)) }
    )
    return toOrderView(syncWithPayment(placed, await openfsp.payments.get(wire.id)))
}

describe("the order view matches the OpenFSP wire format", () => {
    test.each([
        wirePayment(),
        wirePayment({
            next_action: {
                type: "redirect",
                redirect_url: "https://pay.example/approve/pay_test",
                expires_at: "2026-11-15T12:15:00.000Z",
            },
        }),
        wirePayment({ next_action: { type: "redirect", redirect_url: "https://pay.example/x" } }),
        wirePayment({ next_action: { type: "none" } }),
    ])("for the next action of %j", async (wire) => {
        const view = await viewOf(wire)
        expect(view.status).toBe(wire.status)
        expect(view.amount).toEqual(wire.amount)
        expect<unknown>(view.next_action).toEqual(wire.next_action ?? { type: "none" })
    })

    test.each(["succeeded", "failed", "expired", "canceled"] as const)(
        "for the status %s",
        async (status) => {
            const wire = wirePayment({ status })
            expect((await viewOf(wire)).status).toBe(status)
        }
    )
})
