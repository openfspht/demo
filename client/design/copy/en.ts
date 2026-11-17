import type { PaymentStatus } from "#shared/openfsp"

export const en = {
    locale: "en-GB",
    status: {
        pending: "pending",
        succeeded: "succeeded",
        failed: "failed",
        expired: "expired",
        canceled: "canceled",
    } satisfies Record<PaymentStatus, string>,
    language: {
        en: "EN",
        fr: "FR",
        switchTo: { en: "Switch to English", fr: "Passer en français" },
    },
    header: {
        dark: "Dark mode",
        light: "Light mode",
    },
}

export type DesignSystemCopy = typeof en
