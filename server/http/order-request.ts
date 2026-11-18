import { InvalidOrder } from "../application/checkout"

const MAX_LINES = 50

export interface OrderRequest {
    lines: { product_id: string; quantity: number }[]
    phone_number: string
    provider: string
}

export async function readOrderRequest(request: Request): Promise<OrderRequest> {
    let body: unknown
    try {
        body = await request.json()
    } catch {
        throw new InvalidOrder("invalid-body", "the body must be a JSON object")
    }
    if (!isRecord(body)) {
        throw new InvalidOrder("invalid-body", "the body must be a JSON object")
    }
    const { lines, phone_number = "", provider } = body
    if (!Array.isArray(lines) || lines.length > MAX_LINES) {
        throw new InvalidOrder(
            "invalid-body",
            `lines must be an array of at most ${MAX_LINES} lines`
        )
    }
    if (typeof phone_number !== "string" || typeof provider !== "string") {
        throw new InvalidOrder("invalid-body", "phone_number and provider must be strings")
    }
    return { lines: lines.map(readLine), phone_number, provider }
}

function readLine(line: unknown): { product_id: string; quantity: number } {
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
