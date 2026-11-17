import type { Money } from "#shared/openfsp"

const cache = new Map<string, Intl.NumberFormat>()

function cached(key: string, make: () => Intl.NumberFormat): Intl.NumberFormat {
    const existing = cache.get(key)
    if (existing) {
        return existing
    }
    const made = make()
    cache.set(key, made)
    return made
}

const DEFAULT_LOCALE = "en-GB"

export const formatMoney = (money: Money, locale = DEFAULT_LOCALE) =>
    cached(
        `money-${locale}`,
        () =>
            new Intl.NumberFormat(locale, {
                style: "currency",
                currency: "HTG",
                currencyDisplay: "code",
                minimumFractionDigits: 2,
            })
    ).format(money.amount / 100)
