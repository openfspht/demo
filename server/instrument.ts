import * as Sentry from "@sentry/bun"

const dsn = process.env.SENTRY_DSN

if (dsn) {
    Sentry.init({
        dsn,
        environment: process.env.SENTRY_ENVIRONMENT || undefined,
        release: process.env.SENTRY_RELEASE || undefined,
        dataCollection: { userInfo: false, httpBodies: [] },
        tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0,
        initialScope: { tags: { service: "shop-server" } },
    })
}
