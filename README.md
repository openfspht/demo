<p align="center">
  <a href="https://openfsp.org"><img src="https://cdn.openfsp.org/logo/openfsp-logo.svg" alt="OpenFSP" width="280"></a>
</p>

<p align="center"><b>TiMache, a demonstration merchant application using OpenFSP</b></p>

<p align="center">
  <a href="https://github.com/openfspht/demo/actions/workflows/ci.yml"><img src="https://github.com/openfspht/demo/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/openfspht/demo/releases"><img src="https://img.shields.io/github/v/release/openfspht/demo?color=0B3B36" alt="Release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-0B3B36" alt="Apache-2.0"></a>
</p>

TiMache is a small shop that takes payments through OpenFSP: a product catalogue, a checkout that creates payments and a
receiver for signed webhook events. It integrates through the published client SDK,
[`@openfsp/sdk`](https://www.npmjs.com/package/@openfsp/sdk), and works with any server exposing the OpenFSP API. Orders
are held in memory and are discarded when the application restarts.

A public instance runs at [demo.openfsp.org](https://demo.openfsp.org), connected to simulated payment services.

## Run it

With the demonstration environment of [openfspht/openfsp](https://github.com/openfspht/openfsp), which pulls the shop image:

```sh
docker compose --profile demo up    # in the openfsp repository, shop on http://localhost:3000
```

From source, with Bun and an OpenFSP server at `127.0.0.1:8080`:

```sh
git clone git@github.com:openfspht/demo.git
bun install
OPENFSP_API_KEY=... bun run dev     # http://localhost:5174
bun run check && bun run test
```

The image is published on GHCR (`ghcr.io/openfspht/demo`) and Docker Hub (`openfsp/demo`).

## Layout

| Directory | Content |
|---|---|
| [`client`](client) | React interface: catalogue, cart, checkout and order tracking |
| [`server`](server) | Bun server: shop API, payment creation through the SDK and the webhook receiver |
| [`shared`](shared) | Types and rules used by both sides |

The toolchain is [Vite+](https://viteplus.dev): `vp check` formats, lints and type-checks, `vp build` builds the interface.

## Configuration

| Variable | Default |
|---|---|
| `OPENFSP_API_KEY` | required |
| `OPENFSP_BASE_URL` | `http://127.0.0.1:8080` |
| `OPENFSP_ALLOW_PLAIN_HTTP` | `false` |
| `OPENFSP_PROVIDERS` | all payment services exposed by the server |
| `SHOP_WEBHOOK_URL` | `http://127.0.0.1:3000/webhooks/openfsp` |
| `SHOP_PUBLIC_URL` | `http://localhost:5174` |
| `HOST` | `127.0.0.1`, `0.0.0.0` in the image |
| `PORT` | `3000` |
| `SENTRY_DSN` | unset: error reporting to Sentry stays off |
| `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`, `SENTRY_TRACES_SAMPLE_RATE` | unset |

## Who sees an order

The demonstration shop does not use customer accounts. The first order placed from a browser sets an `HttpOnly`
`shop_session` cookie. `GET /api/orders` lists only orders associated with that cookie. `GET /api/orders/:reference`
is accessible to anyone holding the randomly generated reference, which acts as a bearer link. This allows a payer
returning from a payment service to access the order in another browser. Every order response carries only the public
fields defined in [`shared/shop.ts`](shared/shop.ts): never the idempotency key or the payment identifier.

The server binds to the loopback interface by default. The image sets `HOST=0.0.0.0` to allow access from the Compose
stack. Expose it only behind a reverse proxy that terminates TLS.

## License

[Apache-2.0](LICENSE)
