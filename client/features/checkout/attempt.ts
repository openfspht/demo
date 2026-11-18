import { toE164 } from "#shared/phone"
import type { OrderRequestBody } from "#shared/shop"

const STORAGE_KEY = "timache.attempt"

export type Purchase = Omit<OrderRequestBody, "attempt_id">

interface StoredAttempt {
    id: string
    purchase: string
}

function fingerprint(purchase: Purchase): string {
    return JSON.stringify({
        lines: purchase.lines.map((line) => [line.product_id, line.quantity]),
        provider: purchase.provider,
        phone_number: purchase.phone_number.trim() ? toE164(purchase.phone_number) : "",
    })
}

function read(): StoredAttempt | undefined {
    try {
        const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null")
        return typeof stored === "object" &&
            stored !== null &&
            typeof (stored as StoredAttempt).id === "string" &&
            typeof (stored as StoredAttempt).purchase === "string"
            ? (stored as StoredAttempt)
            : undefined
    } catch {
        return undefined
    }
}

export const attemptStore = {
    identify(purchase: Purchase): string {
        const current = fingerprint(purchase)
        const stored = read()
        if (stored?.purchase === current) {
            return stored.id
        }
        const id = crypto.randomUUID()
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ id, purchase: current }))
        } catch {
            return id
        }
        return id
    },
    settle() {
        try {
            localStorage.removeItem(STORAGE_KEY)
        } catch {
            return
        }
    },
}
