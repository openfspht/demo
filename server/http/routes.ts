import { ApiError, InvalidRequestError } from "@openfsp/sdk"
import type { Catalog, ErrorBody, OrderPage, OrderView, ShopErrorCode } from "#shared/shop"

import { AttemptConflict, Checkout, InvalidOrder, UnknownOrder } from "../application/checkout"
import type { WebhookReceiver } from "../application/webhook-receiver"
import { BrowserSessions } from "./browser-sessions"
import { readOrderRequest } from "./order-request"
import { toOrderView } from "./order-view"

const PAGE_SIZE = 12
const MAX_PAGE_SIZE = 100

type Route = (request: Bun.BunRequest) => Promise<Response> | Response

export function routes(
    checkout: Checkout,
    receiver: WebhookReceiver,
    sessions = new BrowserSessions()
): Record<string, Partial<Record<"GET" | "POST", Route>>> {
    return {
        "/api/products": {
            GET: async (request) => {
                sessions.open(request)
                return Response.json({
                    data: checkout.products(),
                    providers: await checkout.providers(),
                } satisfies Catalog)
            },
        },
        "/api/orders": {
            GET: (request) => {
                const query = new URL(request.url).searchParams
                const size = Math.min(
                    Math.max(Number(query.get("size")) || PAGE_SIZE, 1),
                    MAX_PAGE_SIZE
                )
                const page = Math.max(Number(query.get("page")) || 0, 0)
                const session = sessions.current(request)
                const { orders, total } = session
                    ? checkout.list(session, page, size)
                    : { orders: [], total: 0 }
                return Response.json({
                    data: orders.map(toOrderView),
                    page: {
                        number: page,
                        size,
                        total_elements: total,
                        total_pages: Math.ceil(total / size),
                    },
                } satisfies OrderPage)
            },
            POST: (request) =>
                handle(async () => {
                    const body = await readOrderRequest(request)
                    const order = await checkout.place(
                        { session: sessions.open(request), id: body.attempt_id },
                        body.lines,
                        body.phone_number,
                        body.provider
                    )
                    return Response.json(toOrderView(order) satisfies OrderView, { status: 201 })
                }),
        },
        "/api/orders/:reference": {
            GET: (request) =>
                handle(async () =>
                    Response.json(
                        toOrderView(
                            await checkout.read((request.params as { reference: string }).reference)
                        ) satisfies OrderView
                    )
                ),
        },
        "/webhooks/openfsp": {
            POST: async (request) => {
                const reception = await receiver.receive(request)
                if (!reception.accepted) {
                    console.warn(`Rejected a webhook: ${reception.reason}`)
                    return new Response(null, { status: 400 })
                }
                if (reception.outcome === "terminal") {
                    console.warn(
                        `${reception.summary} would leave a terminal state, re-read the payment from the server`
                    )
                } else {
                    console.info(`${reception.summary}: ${reception.outcome}`)
                }
                return new Response(null, { status: 204 })
            },
        },
    }
}

async function handle(work: () => Promise<Response>): Promise<Response> {
    try {
        return await work()
    } catch (error) {
        if (error instanceof InvalidOrder) {
            return failure(400, error.code, error.message)
        }
        if (error instanceof InvalidRequestError) {
            return failure(400, "rejected-request", error.message)
        }
        if (error instanceof AttemptConflict) {
            return failure(
                409,
                "attempt-conflict",
                "this purchase attempt was already used for another cart"
            )
        }
        if (error instanceof UnknownOrder) {
            return failure(404, "unknown-order", "no order matches this reference")
        }
        if (error instanceof ApiError) {
            return Response.json(
                { code: error.code, detail: error.detail ?? error.title } satisfies ErrorBody,
                { status: error.status }
            )
        }
        throw error
    }
}

function failure(status: number, code: ShopErrorCode, detail: string): Response {
    return Response.json({ code, detail } satisfies ErrorBody, { status })
}
