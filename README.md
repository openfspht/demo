<p align="center">
  <a href="https://openfsp.org">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://cdn.openfsp.org/logo/openfsp-logo-inverse.svg">
      <img src="https://cdn.openfsp.org/logo/openfsp-logo.svg" alt="OpenFSP" width="280">
    </picture>
  </a>
</p>

<p align="center"><b>Mache Lakou, a demo merchant built on the OpenFSP TypeScript SDK</b></p>

<p align="center">
  <a href="https://github.com/openfspht/demo-shop/actions/workflows/ci.yml"><img src="https://github.com/openfspht/demo-shop/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-0B3B36" alt="Apache-2.0"></a>
</p>

A merchant built on the OpenFSP TypeScript SDK: a catalogue, a checkout that creates OpenFSP payments and a receiver
for signed webhooks. It works with any OpenFSP server. Orders live in memory and disappear on restart.

## Run it

With the demo from [openfspht/openfsp](https://github.com/openfspht/openfsp), which pulls this image:

```sh
docker compose --profile demo up    # in the openfsp repository, shop on http://localhost:3000
```

From source, with Bun and an OpenFSP server on `127.0.0.1:8080`:

```sh
git clone --recurse-submodules git@github.com:openfspht/demo-shop.git
bun install
OPENFSP_API_KEY=... bun run dev     # http://localhost:5174
bun run check && bun run test
```

The SDK comes from the `openfsp` submodule until it is on npm: `git submodule update --remote openfsp` takes the latest.

| Variable | Default |
|---|---|
| `OPENFSP_API_KEY` | required |
| `OPENFSP_BASE_URL` | `http://127.0.0.1:8080` |
| `OPENFSP_ALLOW_PLAIN_HTTP` | `false` |
| `OPENFSP_PROVIDERS` | every provider the server offers |
| `SHOP_WEBHOOK_URL` | `http://127.0.0.1:3000/webhooks/openfsp` |
| `SHOP_PUBLIC_URL` | `http://localhost:5174` |
| `HOST` | `127.0.0.1`, `0.0.0.0` in the image |
| `PORT` | `3000` |

The image is published on GHCR (`ghcr.io/openfspht/demo-shop`) and Docker Hub (`openfsp/demo-shop`).

## Who sees an order

The shop has no accounts. The first order a browser places sets an `HttpOnly` `shop_session` cookie, and
`GET /api/orders` lists only the orders placed under that cookie. `GET /api/orders/:reference` answers anyone who
holds the reference, which is random and plays the role of a bearer link, so the payer can come back from the provider
in another browser.

The server listens on loopback by default. The image sets `HOST=0.0.0.0` so a compose stack can reach it: keep that
port off the public internet.

## License

[Apache-2.0](LICENSE)
