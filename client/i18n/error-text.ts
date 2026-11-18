import { ShopError } from "@/api/shop"

import type { Messages } from "./en"

export function errorText(t: Messages, error: unknown): string {
    if (!(error instanceof ShopError)) {
        return t.checkout.unreachable
    }
    const code = error.code
    return code && Object.hasOwn(t.errors, code)
        ? t.errors[code as keyof Messages["errors"]]
        : t.errors.payment
}
