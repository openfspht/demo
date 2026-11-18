import type { PaymentEventType, PaymentStatus } from "@openfsp/sdk"

export type { PaymentEventType, PaymentStatus }

export type Timestamp = string

export interface Money {
    amount: number
    currency: "HTG"
}

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
