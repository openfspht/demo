const COOKIE = "shop_session"
const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

export class BrowserSessions {
    current(request: Bun.BunRequest): string | undefined {
        const session = request.cookies.get(COOKIE)
        return session !== null && SESSION_ID.test(session) ? session : undefined
    }

    open(request: Bun.BunRequest): string {
        const existing = this.current(request)
        if (existing) {
            return existing
        }
        const session = crypto.randomUUID()
        request.cookies.set(COOKIE, session, {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
        })
        return session
    }
}
