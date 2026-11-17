export type Timestamp = string

export type Currency = "HTG"

export interface Money {
    amount: number
    currency: Currency
}

export const PAYMENT_STATUSES = ["pending", "succeeded", "failed", "expired", "canceled"] as const

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export const TERMINAL_STATUSES: ReadonlySet<PaymentStatus> = new Set([
    "succeeded",
    "failed",
    "expired",
    "canceled",
])

export type NextAction =
    | { type: "redirect"; redirect_url: string; expires_at?: Timestamp }
    | { type: "payer_approval" }
    | { type: "none" }

export interface PageInfo {
    number: number
    size: number
    total_elements: number
    total_pages: number
}

export interface Page<T> {
    data: T[]
    page: PageInfo
}

export const EVENT_TYPES = [
    "payment.created",
    "payment.succeeded",
    "payment.failed",
    "payment.expired",
    "payment.canceled",
] as const

export type EventType = (typeof EVENT_TYPES)[number]
