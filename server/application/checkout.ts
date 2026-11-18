import {
    ApiError,
    InvalidRequestError,
    Money,
    TransportError,
    type PaymentRequest,
} from "@openfsp/sdk"
import { isE164, toE164 } from "#shared/phone"
import type { InvalidOrderCode, Product, ShopProvider } from "#shared/shop"
import { adoptCreatedPayment, syncWithPayment, type Order } from "../domain/order"
import type { Clock, Orders, PaymentApi } from "./ports"

const MAX_QUANTITY = 20
const MAX_DESCRIPTION = 200
const REFERENCE_LENGTH = 12

export class InvalidOrder extends Error {
    readonly code: InvalidOrderCode

    constructor(code: InvalidOrderCode, message: string) {
        super(message)
        this.code = code
    }
}

export class UnknownOrder extends Error {}

export class AttemptConflict extends Error {}

export interface PurchaseAttempt {
    session: string
    id: string
}

type Purchase = Pick<Order, "lines" | "provider" | "payer_phone_number">

function isSamePurchase(order: Order, purchase: Purchase): boolean {
    return (
        order.provider === purchase.provider &&
        order.payer_phone_number === purchase.payer_phone_number &&
        order.lines.length === purchase.lines.length &&
        order.lines.every(
            (line, index) =>
                line.product_id === purchase.lines[index]!.product_id &&
                line.quantity === purchase.lines[index]!.quantity
        )
    )
}

export interface CheckoutSettings {
    providers?: string[]
    publicUrl: string
}

export class Checkout {
    private readonly catalog: Product[]
    private readonly paymentApi: PaymentApi
    private readonly orders: Orders
    private readonly clock: Clock
    private readonly settings: CheckoutSettings

    constructor(
        catalog: Product[],
        paymentApi: PaymentApi,
        orders: Orders,
        clock: Clock,
        settings: CheckoutSettings
    ) {
        this.catalog = catalog
        this.paymentApi = paymentApi
        this.orders = orders
        this.clock = clock
        this.settings = settings
    }

    products(): Product[] {
        return this.catalog
    }

    async providers(): Promise<ShopProvider[]> {
        const offered = await this.paymentApi.providers()
        return offered
            .filter(
                (provider) =>
                    !this.settings.providers || this.settings.providers.includes(provider.id)
            )
            .map((provider) => ({
                id: provider.id,
                name: provider.displayName,
                logo_url: provider.logoUrl ?? null,
            }))
    }

    async place(
        attempt: PurchaseAttempt,
        requested: { product_id: string; quantity: number }[],
        phoneNumber: string,
        provider: string
    ): Promise<Order> {
        const lines = requested.map(({ product_id, quantity }) => {
            const product = this.catalog.find((candidate) => candidate.id === product_id)
            if (
                !product ||
                !Number.isInteger(quantity) ||
                quantity < 1 ||
                quantity > MAX_QUANTITY
            ) {
                throw new InvalidOrder(
                    "invalid-line",
                    `each line needs a known product and a quantity from 1 to ${MAX_QUANTITY}`
                )
            }
            return {
                product_id,
                name: product.name.en,
                quantity,
                unit_price: product.price,
            }
        })
        if (lines.length === 0) {
            throw new InvalidOrder("empty-cart", "a cart needs at least one line")
        }
        const payerPhoneNumber = phoneNumber.trim() ? toE164(phoneNumber) : undefined
        if (payerPhoneNumber !== undefined && !isE164(payerPhoneNumber)) {
            throw new InvalidOrder(
                "invalid-phone",
                "phone_number must be an E.164 number such as +50934567890 or an eight-digit Haitian number"
            )
        }
        const known = (await this.providers()).some((candidate) => candidate.id === provider)
        if (!known) {
            throw new InvalidOrder("unknown-provider", `${provider} is not an offered provider`)
        }
        const purchase = { lines, provider, payer_phone_number: payerPhoneNumber }
        const order = this.resume(attempt, purchase) ?? this.open(attempt, purchase)
        if (order.payment_id) {
            return order
        }
        const payment = await this.createPayment(order)
        return this.revise(order.reference, (current) => adoptCreatedPayment(current, payment))
    }

    private resume(attempt: PurchaseAttempt, purchase: Purchase): Order | undefined {
        const existing = this.orders.findAttempt(attempt.session, attempt.id)
        if (existing && !isSamePurchase(existing, purchase)) {
            throw new AttemptConflict(attempt.id)
        }
        return existing
    }

    private open(attempt: PurchaseAttempt, purchase: Purchase): Order {
        const order: Order = {
            reference: this.newReference(),
            session_id: attempt.session,
            attempt_id: attempt.id,
            lines: purchase.lines,
            amount: {
                amount: purchase.lines.reduce(
                    (total, line) => total + line.unit_price.amount * line.quantity,
                    0
                ),
                currency: purchase.lines[0]!.unit_price.currency,
            },
            idempotency_key: crypto.randomUUID(),
            provider: purchase.provider,
            ...(purchase.payer_phone_number
                ? { payer_phone_number: purchase.payer_phone_number }
                : {}),
            status: "pending",
            created_at: this.clock.now().toISOString(),
            events: [],
            version: 0,
        }
        this.orders.add(order)
        return order
    }

    private paymentRequest(order: Order): PaymentRequest {
        return {
            reference: order.reference,
            amount: Money.centimes(order.amount.amount),
            provider: order.provider,
            ...(order.payer_phone_number ? { payerPhoneNumber: order.payer_phone_number } : {}),
            description: order.lines
                .map((line) => `${line.quantity} x ${line.name}`)
                .join(", ")
                .slice(0, MAX_DESCRIPTION),
            returnUrl: `${this.settings.publicUrl}/orders/${order.reference}`,
            metadata: {
                items: order.lines.map((line) => `${line.product_id}:${line.quantity}`).join(","),
            },
        }
    }

    async read(reference: string): Promise<Order> {
        const order = this.orders.find(reference)
        if (!order) {
            throw new UnknownOrder(reference)
        }
        const payment = order.payment_id
            ? await this.paymentApi.getPayment(order.payment_id)
            : await this.paymentApi.findPayment(reference)
        if (!payment) {
            return this.orders.find(reference) ?? order
        }
        return this.revise(reference, (current) => syncWithPayment(current, payment))
    }

    private revise(reference: string, change: (current: Order) => Order): Order {
        for (;;) {
            const current = this.orders.find(reference)
            if (!current) {
                throw new UnknownOrder(reference)
            }
            const stored = this.orders.replace(change(current))
            if (stored) {
                return stored
            }
        }
    }

    private newReference(): string {
        for (;;) {
            const reference = `SHOP-${crypto.randomUUID().replaceAll("-", "").slice(0, REFERENCE_LENGTH).toUpperCase()}`
            if (!this.orders.find(reference)) {
                return reference
            }
        }
    }

    private async createPayment(order: Order) {
        try {
            return await this.paymentApi.createPayment(
                this.paymentRequest(order),
                order.idempotency_key
            )
        } catch (failure) {
            if (failure instanceof InvalidRequestError) {
                this.orders.remove(order.reference)
                throw new InvalidOrder("rejected-request", failure.message)
            }
            if (
                (failure instanceof ApiError || failure instanceof TransportError) &&
                failure.effect === "none"
            ) {
                this.orders.remove(order.reference)
            }
            throw failure
        }
    }

    list(session: string, page: number, size: number): { orders: Order[]; total: number } {
        return this.orders.ofSession(session, page * size, size)
    }
}
