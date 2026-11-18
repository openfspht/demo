import type { Money, NextAction, Page, PaymentEventType, PaymentStatus } from "./openfsp"

export type Text = { en: string; fr: string }

export type Aisle = "coffee" | "cacao" | "fruit" | "spirits" | "pantry"

export interface Product {
    id: string
    aisle: Aisle
    name: Text
    description: Text
    origin: Text
    unit: Text
    price: Money
}

export interface ShopProvider {
    id: string
    name: string
    logo_url: string | null
}

export interface Catalog {
    data: Product[]
    providers: ShopProvider[]
}

export interface OrderLineView {
    product_id: string
    name: string
    quantity: number
    unit_price: Money
}

export interface OrderEventView {
    id: string
    type: PaymentEventType
    sequence: number
    received_at: string
}

export interface OrderView {
    reference: string
    lines: OrderLineView[]
    amount: Money
    provider: string
    status: PaymentStatus
    next_action?: NextAction
    created_at: string
    events: OrderEventView[]
}

export type OrderPage = Page<OrderView>

export interface OrderRequestBody {
    attempt_id: string
    lines: { product_id: string; quantity: number }[]
    phone_number: string
    provider: string
}
