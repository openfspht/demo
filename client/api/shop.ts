import type { Catalog, ErrorBody, OrderPage, OrderRequestBody, OrderView } from "#shared/shop"

export class ShopError extends Error {
    readonly status: number
    readonly code: string | undefined

    constructor(status: number, body: Partial<ErrorBody>) {
        super(body.detail ?? `the shop answered ${status}`)
        this.status = status
        this.code = typeof body.code === "string" ? body.code : undefined
    }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(path, {
        ...init,
        headers: { "Content-Type": "application/json" },
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
        throw new ShopError(response.status, payload as Partial<ErrorBody>)
    }
    return payload as T
}

export const shop = {
    catalog: () => request<Catalog>("/api/products"),
    orders: (page: number) => request<OrderPage>(`/api/orders?page=${page}&size=12`),
    read: (reference: string) => request<OrderView>(`/api/orders/${encodeURIComponent(reference)}`),
    order: (body: OrderRequestBody) =>
        request<OrderView>("/api/orders", {
            method: "POST",
            body: JSON.stringify(body),
        }),
}
