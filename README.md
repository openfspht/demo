<p align="center">
  <a href="https://openfsp.org">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://cdn.openfsp.org/logo/openfsp-logo-inverse.svg">
      <img src="https://cdn.openfsp.org/logo/openfsp-logo.svg" alt="OpenFSP" width="280">
    </picture>
  </a>
</p>

<p align="center"><b>Mache Lakou, a demonstration merchant application using OpenFSP</b></p>

<p align="center">
  <a href="https://github.com/openfspht/demo/actions/workflows/ci.yml"><img src="https://github.com/openfspht/demo/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-0B3B36" alt="Apache-2.0"></a>
</p>

Mache Lakou demonstrates merchant integration with OpenFSP through a product catalogue, a checkout that creates
payments and a receiver for signed webhook events. It uses an OpenFSP client SDK and connects to a server exposing the
required OpenFSP capabilities. Orders are stored in memory and are discarded when the application restarts.

## Run it

To run the demonstration environment from [openfspht/openfsp](https://github.com/openfspht/openfsp), which retrieves the shop image:

```sh
docker compose --profile demo up    # in the openfsp repository, shop on http://localhost:3000
```

To run from source, use Bun and an OpenFSP server at `127.0.0.1:8080`:

```sh
git clone --recurse-submodules git@github.com:openfspht/demo.git
bun install
OPENFSP_API_KEY=... bun run dev     # http://localhost:5174
bun run check && bun run test
```

This checkout obtains the SDK from the `openfsp` submodule. Run `git submodule update --remote openfsp` to update it to the latest revision tracked by the submodule.

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

The image is published on GHCR (`ghcr.io/openfspht/demo`) and Docker Hub (`openfsp/demo`).

## Who sees an order

The demonstration shop does not use customer accounts. The first order placed from a browser sets an `HttpOnly`
`shop_session` cookie. `GET /api/orders` lists only orders associated with that cookie. `GET /api/orders/:reference`
is accessible to anyone holding the randomly generated reference, which acts as a bearer link. This allows a payer
returning from a payment service to access the order in another browser.

The server binds to the loopback interface by default. The image sets `HOST=0.0.0.0` to allow access from the Compose
stack. Do not expose this port to the public internet.

## License

[Apache-2.0](LICENSE)
