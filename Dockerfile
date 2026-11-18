FROM oven/bun:1.4.4 AS build

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

FROM oven/bun:1.4.4-slim AS dependencies

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.4.4-slim

WORKDIR /app

COPY --from=dependencies /app/node_modules node_modules
COPY --from=build /app/dist dist

COPY package.json ./
COPY server server
COPY shared shared

USER bun

ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=5 CMD ["bun", "-e", "process.exit((await fetch('http://127.0.0.1:3000/health')).ok ? 0 : 1)"]

ENTRYPOINT ["bun", "--preload", "./server/instrument.ts", "server/main.ts"]
