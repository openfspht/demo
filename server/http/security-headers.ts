type Handler = (request: Bun.BunRequest) => Promise<Response> | Response

export function securityHeaders(monitoringDsn: string): Record<string, string> {
    const connect = ["'self'", ...originOf(monitoringDsn)].join(" ")
    return {
        "Content-Security-Policy": [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self'",
            "img-src 'self' https:",
            "font-src 'self'",
            `connect-src ${connect}`,
            "object-src 'none'",
            "base-uri 'none'",
            "form-action 'self'",
            "frame-ancestors 'none'",
        ].join("; "),
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
    }
}

export function secured(
    handlers: Partial<Record<string, Handler>>,
    headers: Record<string, string>
): Partial<Record<string, Handler>> {
    return Object.fromEntries(
        Object.entries(handlers).map(([method, handler]) => [
            method,
            async (request: Bun.BunRequest) => withHeaders(await handler!(request), headers),
        ])
    )
}

export function withHeaders(response: Response, headers: Record<string, string>): Response {
    for (const [name, value] of Object.entries(headers)) {
        response.headers.set(name, value)
    }
    return response
}

function originOf(dsn: string): string[] {
    if (!dsn) {
        return []
    }
    try {
        return [new URL(dsn).origin]
    } catch {
        return []
    }
}
