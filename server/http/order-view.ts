import type { NextAction as PaymentNextAction } from "@openfsp/sdk"
import type { NextAction } from "#shared/openfsp"
import type { OrderView } from "#shared/shop"

import type { Order } from "../domain/order"

export function toOrderView(order: Order): OrderView {
    return {
        reference: order.reference,
        lines: order.lines.map((line) => ({
            product_id: line.product_id,
            name: line.name,
            quantity: line.quantity,
            unit_price: line.unit_price,
        })),
        amount: order.amount,
        provider: order.provider,
        status: order.status,
        ...(order.next_action ? { next_action: toNextActionView(order.next_action) } : {}),
        created_at: order.created_at,
        events: order.events.map((event) => ({
            id: event.id,
            type: event.type,
            sequence: event.sequence,
            received_at: event.received_at,
        })),
    }
}

function toNextActionView(action: PaymentNextAction): NextAction {
    if (action.type === "redirect") {
        return {
            type: "redirect",
            redirect_url: action.url,
            ...(action.expiresAt ? { expires_at: action.expiresAt.toISOString() } : {}),
        }
    }
    return { type: action.type }
}
