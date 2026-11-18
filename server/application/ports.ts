import type { Payment, PaymentEvent, PaymentRequest, Provider } from "@openfsp/sdk"

import type { Order } from "../domain/order"

export interface PaymentApi {
    createPayment(request: PaymentRequest, idempotencyKey: string): Promise<Payment>
    getPayment(id: string): Promise<Payment>
    findPayment(reference: string): Promise<Payment | undefined>
    providers(): Promise<readonly Pick<Provider, "id" | "displayName" | "logoUrl">[]>
}

export interface Orders {
    add(order: Order): void
    /** Compare and set: stores the order only if its version is still the stored one. */
    replace(order: Order): Order | undefined
    remove(reference: string): void
    find(reference: string): Order | undefined
    findAttempt(session: string, attempt: string): Order | undefined
    ofSession(session: string, offset: number, limit: number): { orders: Order[]; total: number }
}

export interface ProcessedEvents {
    has(eventId: string): boolean
    remember(eventId: string): void
}

export type Authenticity =
    | { verified: true; event: PaymentEvent }
    | { verified: false; reason: string }

export interface WebhookAuthenticity {
    verify(request: Request): Promise<Authenticity>
}

export interface Clock {
    now(): Date
}
