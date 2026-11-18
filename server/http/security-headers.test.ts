import { describe, expect, test } from "bun:test"

import { secured, securityHeaders } from "./security-headers"

describe("security headers", () => {
    test("forbid framing and sniffing, send no referrer and allow only the monitoring origin", () => {
        const headers = securityHeaders("https://public@o1.ingest.sentry.io/42")
        const policy = headers["Content-Security-Policy"]!

        expect(policy).toContain("frame-ancestors 'none'")
        expect(policy).toContain("script-src 'self'")
        expect(policy).toContain("connect-src 'self' https://o1.ingest.sentry.io")
        expect(policy).not.toContain("public")
        expect(headers["X-Content-Type-Options"]).toBe("nosniff")
        expect(headers["Referrer-Policy"]).toBe("no-referrer")
    })

    test("allow only the shop itself without monitoring", () => {
        expect(securityHeaders("")["Content-Security-Policy"]).toContain("connect-src 'self';")
        expect(securityHeaders("not a url")["Content-Security-Policy"]).toContain(
            "connect-src 'self';"
        )
    })

    test("are added to every response of a route", async () => {
        const headers = securityHeaders("")
        const handlers = secured({ GET: () => new Response("<!doctype html>") }, headers)
        const response = await handlers.GET!(new Request("http://shop.test/") as Bun.BunRequest)

        for (const [name, value] of Object.entries(headers)) {
            expect(response.headers.get(name)).toBe(value)
        }
    })
})
