import type { ShopErrorCode } from "#shared/shop"

export const en = {
    shop: "TiMache",
    tagline: "A selection of Haitian local products.",
    demo: "Demonstration shop: fictional merchant, no orders are shipped.",
    nav: { shop: "Shop", orders: "Orders", cart: "Cart" },
    aisles: {
        all: "Everything",
        coffee: "Coffee",
        cacao: "Cacao",
        fruit: "Fruit",
        spirits: "Rum",
        pantry: "Pantry",
    },
    featured: "Weekly selection",
    add: "Add to cart",
    added: "In your cart",
    from: "Origin",
    aisle: "Aisle",
    size: "Size",
    view: (name: string) => `See ${name}`,
    back: "Back to the shop",
    cart: {
        title: "Your cart",
        empty: "Your cart is empty.",
        browse: "Browse products",
        quantity: "Quantity",
        remove: "Remove",
        decrease: (name: string) => `Decrease quantity of ${name}`,
        increase: (name: string) => `Increase quantity of ${name}`,
        total: "Total",
        checkout: "Go to payment",
        count: (count: number) => (count === 1 ? "1 item" : `${count} items`),
    },
    stations: {
        cart: "Cart",
        pay: "Payment",
        approve: "Approval",
        done: "Confirmed",
    },
    checkout: {
        title: "Payment",
        provider: "Pay with",
        phone: "Phone number",
        phoneHint:
            "Optional. Enter the number used to approve the payment if the service requires one. Accepted format: +509 40 00 0000 or the eight-digit national number.",
        pay: (total: string) => `Pay ${total}`,
        paying: "Creating the payment",
        secured:
            "Payment status is confirmed by the payment server. Returning to the shop does not by itself confirm payment.",
        noProvider: "No payment services are currently available.",
        unreachable: "Unable to reach the payment server. Check your connection and try again.",
    },
    order: {
        title: (reference: string) => `Order ${reference}`,
        status: {
            pending: "Waiting for your payment",
            succeeded: "Payment confirmed",
            failed: "Payment failed",
            expired: "Payment period expired",
            canceled: "Payment cancelled",
        } as Record<string, string>,
        hint: {
            pending: "This page updates automatically when the payment outcome becomes available.",
            succeeded: "The demonstration payment is confirmed. No order will be shipped.",
            failed: "You can try again with another payment service.",
            expired: "Start the payment again from your cart.",
            canceled: "The payment has been cancelled.",
        } as Record<string, string>,
        continueTo: (provider: string) => `Continue to ${provider}`,
        approve: "Approve the payment on your phone.",
        paidWith: "Paid with",
        webhooks: "Verified webhooks",
        webhooksHint:
            "The shop verified the signature of each webhook event accepted to update the payment status.",
        noWebhooks: "No webhook received yet.",
        source: "Status retrieved from the payment server.",
        notFound: "No order matches this reference. Check the reference used.",
    },
    errors: {
        "invalid-body": "The shop could not read the order. Reload the page and try again.",
        "invalid-line":
            "A product in your cart is no longer offered or its quantity is not between 1 and 20.",
        "empty-cart": "Your cart is empty.",
        "unknown-provider": "This payment service is not available. Choose another one.",
        "invalid-phone":
            "Enter a phone number such as +509 40 00 0000 or the eight-digit national number.",
        "rejected-request":
            "The payment request was refused. Check the phone number and try again.",
        "attempt-conflict": "Your cart changed during the payment. Try again.",
        "unknown-order": "No order matches this reference. Check the reference used.",
        payment:
            "The payment server could not create the payment. Try again: the same order will be resumed.",
    } satisfies Record<ShopErrorCode | "payment", string>,
    orders: {
        title: "Your orders",
        empty: "No order yet.",
        previous: "Previous",
        next: "Next",
        page: (page: number, total: number) => `Page ${page} of ${total}`,
    },
}

export type Messages = typeof en
