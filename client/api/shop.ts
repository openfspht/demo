import type { Catalog, OrderPage, OrderRequestBody, OrderView } from "#shared/shop"

export class ShopError extends Error {
    readonly status: number

    constructor(message: string, status: number) {
        super(message)
        this.status = status
    }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(path, {
        ...init,
        headers: { "Content-Type": "application/json" },
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
        throw new ShopError(
            payload.detail ??
                payload.title ??
                payload.error ??
                `${path} answered ${response.status}`,
            response.status
        )
    }
    return payload as T
}

export const shop = {
    catalog: () => request<Catalog>("/api/products"),
    orders: (page: number) => request<OrderPage>(`/api/orders?page=${page}&size=12`),
    read: (reference: string) => request<OrderView>(`/api/orders/${encodeURIComponent(reference)}`),
    order: (lines: OrderRequestBody["lines"], phoneNumber: string, provider: string) =>
        request<OrderView>("/api/orders", {
            method: "POST",
            body: JSON.stringify({
                lines,
                phone_number: phoneNumber,
                provider,
            } satisfies OrderRequestBody),
        }),
}
