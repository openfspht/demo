FROM oven/bun:1.4.4 AS build
WORKDIR /app
COPY package.json bun.lock ./
COPY openfsp/sdks/typescript/package.json openfsp/sdks/typescript/
COPY openfsp/sdks/typescript/src openfsp/sdks/typescript/src
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1.4.4-slim AS dependencies
WORKDIR /app
COPY package.json bun.lock ./
COPY openfsp/sdks/typescript/package.json openfsp/sdks/typescript/
COPY openfsp/sdks/typescript/src openfsp/sdks/typescript/src
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.4.4-slim
WORKDIR /app
COPY --from=dependencies /app/node_modules node_modules
COPY --from=dependencies /app/openfsp openfsp
COPY --from=build /app/dist dist
COPY package.json ./
COPY server server
COPY shared shared
USER bun
ENV HOST=0.0.0.0
ENV PORT=3000
EXPOSE 3000
ENTRYPOINT ["bun", "--conditions=openfsp-source", "server/main.ts"]
