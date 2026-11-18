import { InvalidSignatureError, type OpenFsp, type PaymentRequest } from "@openfsp/sdk"

import type { Order } from "../domain/order"
import type {
    Authenticity,
    Clock,
    Orders,
    PaymentApi,
    ProcessedEvents,
    WebhookAuthenticity,
} from "../application/ports"

export class OpenFspPaymentApi implements PaymentApi {
    private readonly openfsp: OpenFsp

    constructor(openfsp: OpenFsp) {
        this.openfsp = openfsp
    }

    createPayment = (request: PaymentRequest, idempotencyKey: string) =>
        this.openfsp.payments.create(request, { idempotencyKey })

    getPayment = (id: string) => this.openfsp.payments.get(id)

    findPayment = (reference: string) => this.openfsp.payments.findByReference(reference)

    providers = () => this.openfsp.providers()
}

export class SignedWebhooks implements WebhookAuthenticity {
    private readonly openfsp: OpenFsp

    constructor(openfsp: OpenFsp) {
        this.openfsp = openfsp
    }

    async verify(request: Request): Promise<Authenticity> {
        try {
            return {
                verified: true,
                event: await this.openfsp.webhooks.verify(request),
            }
        } catch (failure) {
            if (failure instanceof InvalidSignatureError) {
                return { verified: false, reason: failure.message }
            }
            throw failure
        }
    }
}

export interface Retention {
    capacity: number
    maxAgeMs: number
    clock: Clock
}

export class InMemoryOrders implements Orders {
    private readonly orders = new Map<string, { order: Order; addedAt: number }>()
    private readonly bySession = new Map<string, string[]>()
    private readonly attempts = new Map<string, Map<string, string>>()
    private readonly retention: Retention

    constructor(retention: Retention) {
        this.retention = retention
    }

    add(order: Order) {
        if (this.orders.has(order.reference)) {
            throw new Error(`order ${order.reference} already exists`)
        }
        if (this.findAttempt(order.session_id, order.attempt_id)) {
            throw new Error(`attempt ${order.attempt_id} already has an order`)
        }
        this.evict()
        this.orders.set(order.reference, { order, addedAt: this.retention.clock.now().getTime() })
        this.bySession.set(order.session_id, [
            ...(this.bySession.get(order.session_id) ?? []),
            order.reference,
        ])
        const attempts = this.attempts.get(order.session_id) ?? new Map<string, string>()
        attempts.set(order.attempt_id, order.reference)
        this.attempts.set(order.session_id, attempts)
    }

    replace(order: Order) {
        const entry = this.orders.get(order.reference)
        if (entry?.order.version !== order.version) {
            return undefined
        }
        const stored = { ...order, version: order.version + 1 }
        this.orders.set(order.reference, { order: stored, addedAt: entry.addedAt })
        return stored
    }

    remove(reference: string) {
        const entry = this.orders.get(reference)
        if (!entry) {
            return
        }
        this.orders.delete(reference)
        const owned = (this.bySession.get(entry.order.session_id) ?? []).filter(
            (candidate) => candidate !== reference
        )
        const attempts = this.attempts.get(entry.order.session_id)
        attempts?.delete(entry.order.attempt_id)
        if (owned.length > 0) {
            this.bySession.set(entry.order.session_id, owned)
        } else {
            this.bySession.delete(entry.order.session_id)
            this.attempts.delete(entry.order.session_id)
        }
    }

    find(reference: string) {
        return this.orders.get(reference)?.order
    }

    findAttempt(session: string, attempt: string) {
        const reference = this.attempts.get(session)?.get(attempt)
        return reference ? this.find(reference) : undefined
    }

    ofSession(session: string, offset: number, limit: number) {
        const owned = this.bySession.get(session) ?? []
        const end = owned.length - offset
        return {
            orders: owned
                .slice(Math.max(end - limit, 0), Math.max(end, 0))
                .reverse()
                .map((reference) => this.orders.get(reference)!.order),
            total: owned.length,
        }
    }

    private evict() {
        const oldest = this.retention.clock.now().getTime() - this.retention.maxAgeMs
        for (const [reference, entry] of this.orders) {
            if (this.orders.size < this.retention.capacity && entry.addedAt > oldest) {
                return
            }
            this.remove(reference)
        }
    }
}

export class InMemoryProcessedEvents implements ProcessedEvents {
    private readonly seen = new Map<string, number>()
    private readonly retention: Retention

    constructor(retention: Retention) {
        this.retention = retention
    }

    has(eventId: string): boolean {
        const rememberedAt = this.seen.get(eventId)
        return rememberedAt !== undefined && rememberedAt > this.oldest()
    }

    remember(eventId: string) {
        const oldest = this.oldest()
        for (const [id, rememberedAt] of this.seen) {
            if (this.seen.size < this.retention.capacity && rememberedAt > oldest) {
                break
            }
            this.seen.delete(id)
        }
        this.seen.delete(eventId)
        this.seen.set(eventId, this.retention.clock.now().getTime())
    }

    private oldest() {
        return this.retention.clock.now().getTime() - this.retention.maxAgeMs
    }
}

export const systemClock: Clock = { now: () => new Date() }
