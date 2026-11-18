import { describe, expect, test } from "bun:test"

import type { Order } from "../domain/order"
import { InMemoryOrders, InMemoryProcessedEvents } from "./adapters"

const HOUR_MS = 3_600_000

function movingClock() {
    let now = new Date("2026-11-09T15:00:00Z").getTime()
    return {
        now: () => new Date(now),
        advance: (milliseconds: number) => {
            now += milliseconds
        },
    }
}

function order(reference: string, session: string): Order {
    return {
        reference,
        session_id: session,
        lines: [],
        amount: { amount: 35_000, currency: "HTG" },
        idempotency_key: `key-${reference}`,
        provider: "mock_alpha",
        status: "pending",
        created_at: "2026-11-09T15:00:00Z",
        events: [],
        version: 0,
    }
}

const references = (orders: Order[]) => orders.map((it) => it.reference)

describe("in-memory orders", () => {
    test("lists the orders of one session newest first, by page", () => {
        const orders = new InMemoryOrders({
            capacity: 10,
            maxAgeMs: HOUR_MS,
            clock: movingClock(),
        })
        for (const reference of ["A", "B", "C", "D", "E"]) {
            orders.add(order(reference, "mine"))
        }
        orders.add(order("X", "theirs"))

        expect(orders.ofSession("mine", 0, 2)).toMatchObject({ total: 5 })
        expect(references(orders.ofSession("mine", 0, 2).orders)).toEqual(["E", "D"])
        expect(references(orders.ofSession("mine", 4, 2).orders)).toEqual(["A"])
        expect(references(orders.ofSession("mine", 6, 2).orders)).toEqual([])
        expect(references(orders.ofSession("theirs", 0, 10).orders)).toEqual(["X"])
        expect(orders.ofSession("nobody", 0, 10)).toEqual({ orders: [], total: 0 })
    })

    test("drops the oldest order beyond its capacity", () => {
        const orders = new InMemoryOrders({ capacity: 2, maxAgeMs: HOUR_MS, clock: movingClock() })
        orders.add(order("A", "mine"))
        orders.add(order("B", "mine"))
        orders.add(order("C", "mine"))

        expect(orders.find("A")).toBeUndefined()
        expect(references(orders.ofSession("mine", 0, 10).orders)).toEqual(["C", "B"])
    })

    test("drops the orders older than the retention", () => {
        const clock = movingClock()
        const orders = new InMemoryOrders({ capacity: 10, maxAgeMs: HOUR_MS, clock })
        orders.add(order("A", "old"))
        clock.advance(HOUR_MS + 1)
        orders.add(order("B", "new"))

        expect(orders.find("A")).toBeUndefined()
        expect(orders.ofSession("old", 0, 10).total).toBe(0)
        expect(orders.find("B")).toBeDefined()
    })

    test("replaces an order only from its stored version", () => {
        const orders = new InMemoryOrders({ capacity: 10, maxAgeMs: HOUR_MS, clock: movingClock() })
        orders.add(order("A", "mine"))
        const stored = orders.replace({ ...order("A", "mine"), status: "succeeded" })

        expect(stored).toMatchObject({ status: "succeeded", version: 1 })
        expect(orders.replace({ ...order("A", "mine"), status: "failed" })).toBeUndefined()
        expect(orders.find("A")).toMatchObject({ status: "succeeded", version: 1 })
    })
})

describe("in-memory processed events", () => {
    test("forgets the oldest event beyond its capacity", () => {
        const events = new InMemoryProcessedEvents({
            capacity: 2,
            maxAgeMs: HOUR_MS,
            clock: movingClock(),
        })
        events.remember("evt_1")
        events.remember("evt_2")
        events.remember("evt_3")

        expect([events.has("evt_1"), events.has("evt_2"), events.has("evt_3")]).toEqual([
            false,
            true,
            true,
        ])
    })

    test("forgets an event older than the retention", () => {
        const clock = movingClock()
        const events = new InMemoryProcessedEvents({ capacity: 10, maxAgeMs: HOUR_MS, clock })
        events.remember("evt_1")
        clock.advance(HOUR_MS + 1)

        expect(events.has("evt_1")).toBe(false)
    })
})
