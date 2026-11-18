import type { OrderRequestBody } from "#shared/shop"

import { InvalidOrder } from "../application/checkout"

const MAX_LINES = 50
const ATTEMPT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

export async function readOrderRequest(request: Request): Promise<OrderRequestBody> {
    let body: unknown
    try {
        body = await request.json()
    } catch {
        throw new InvalidOrder("invalid-body", "the body must be a JSON object")
    }
    if (!isRecord(body)) {
        throw new InvalidOrder("invalid-body", "the body must be a JSON object")
    }
    const { attempt_id, lines, phone_number = "", provider } = body
    if (typeof attempt_id !== "string" || !ATTEMPT_ID.test(attempt_id)) {
        throw new InvalidOrder("invalid-body", "attempt_id must be a random UUID")
    }
    if (!Array.isArray(lines) || lines.length > MAX_LINES) {
        throw new InvalidOrder(
            "invalid-body",
            `lines must be an array of at most ${MAX_LINES} lines`
        )
    }
    if (typeof phone_number !== "string" || typeof provider !== "string") {
        throw new InvalidOrder("invalid-body", "phone_number and provider must be strings")
    }
    return { attempt_id, lines: lines.map(readLine), phone_number, provider }
}

function readLine(line: unknown): OrderRequestBody["lines"][number] {
    if (
        !isRecord(line) ||
        typeof line.product_id !== "string" ||
        typeof line.quantity !== "number"
    ) {
        throw new InvalidOrder(
            "invalid-line",
            "each line must hold a product_id string and a quantity number"
        )
    }
    return { product_id: line.product_id, quantity: line.quantity }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}
