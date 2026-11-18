import type { Payment } from "@openfsp/sdk"

import {
    applyPaymentEvent,
    RESYNC_OUTCOMES,
    syncWithPayment,
    type EventOutcome,
} from "../domain/order"
import type { Clock, Orders, PaymentApi, ProcessedEvents, WebhookAuthenticity } from "./ports"

export type Reception =
    | { accepted: false; reason: string }
    | {
          accepted: true
          outcome: EventOutcome | "duplicate" | "unknown-order"
          summary: string
      }

export class WebhookReceiver {
    private readonly authenticity: WebhookAuthenticity
    private readonly orders: Orders
    private readonly processed: ProcessedEvents
    private readonly paymentApi: PaymentApi
    private readonly clock: Clock

    constructor(
        authenticity: WebhookAuthenticity,
        orders: Orders,
        processed: ProcessedEvents,
        paymentApi: PaymentApi,
        clock: Clock
    ) {
        this.authenticity = authenticity
        this.orders = orders
        this.processed = processed
        this.paymentApi = paymentApi
        this.clock = clock
    }

    async receive(request: Request): Promise<Reception> {
        const result = await this.authenticity.verify(request)
        if (!result.verified) {
            return { accepted: false, reason: result.reason }
        }
        const event = result.event
        const summary = `${event.type} #${event.sequence} for ${event.reference}`
        if (this.processed.has(event.id)) {
            return { accepted: true, outcome: "duplicate", summary }
        }
        const received = {
            id: event.id,
            type: event.type,
            sequence: event.sequence,
            status: event.payment.status,
            nextAction: event.payment.nextAction,
        }
        const receivedAt = this.clock.now().toISOString()
        let latest: Payment | undefined
        for (;;) {
            const current = this.orders.find(event.reference)
            if (!current) {
                return { accepted: true, outcome: "unknown-order", summary }
            }
            const { order: applied, outcome } = applyPaymentEvent(
                { ...current, payment_id: current.payment_id ?? event.payment.id },
                received,
                receivedAt
            )
            const resync = RESYNC_OUTCOMES.has(outcome)
            if (resync && !latest) {
                latest = await this.paymentApi.getPayment(event.payment.id)
                continue
            }
            if (
                this.orders.replace(resync && latest ? syncWithPayment(applied, latest) : applied)
            ) {
                this.processed.remember(event.id)
                return { accepted: true, outcome, summary }
            }
        }
    }
}
