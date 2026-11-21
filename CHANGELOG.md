# Changelog

## [0.3.1](https://github.com/openfspht/demo/compare/v0.3.0...v0.3.1) (2026-11-21)


### Bug Fixes

* answer 400 to an invalid order request without keeping an order ([76f7739](https://github.com/openfspht/demo/commit/76f7739d8d69a06a70e8eb9fd69e31487e6a969c))
* answer explicit order views from a contract shared with the client ([4e63205](https://github.com/openfspht/demo/commit/4e63205b481019ed7540bc2bec4c06c2f34f13ce))
* bound the in-memory stores and index orders by session ([af9d85b](https://github.com/openfspht/demo/commit/af9d85bf851c3c76263fbadbf29674b53947e50a))
* give each purchase attempt a stable order and idempotency key ([649f8a7](https://github.com/openfspht/demo/commit/649f8a7762a7e6466b4f38c643248477c5772a9a))
* re-evaluate order writes against the current version ([cf09916](https://github.com/openfspht/demo/commit/cf0991610e03e00e120ba508e838f30a9bb9b89d))
* send security headers with every response of the shop ([7888e51](https://github.com/openfspht/demo/commit/7888e512698b5ca94516f65259b98f9fe9f6413f))
* show checkout errors from the translation files ([8454a69](https://github.com/openfspht/demo/commit/8454a69cf59ac62a2a6039b78f1724268500eb4d))

## [0.3.0](https://github.com/openfspht/demo/compare/v0.2.0...v0.3.0) (2026-11-17)


### Features

* expose a health endpoint ([f098dfa](https://github.com/openfspht/demo/commit/f098dfa32ecce0e45260d8144b200aecd30abf2f))

## [0.2.0](https://github.com/openfspht/demo/compare/v0.1.0...v0.2.0) (2026-11-17)


### Features

* report errors to Sentry when a DSN is configured ([a174761](https://github.com/openfspht/demo/commit/a174761cf5e2443d5f2fe20007cf9b07138a4e78))

## 0.1.0 (2026-11-17)


### Features

* add the Mache Lakou demo shop ([4356ff3](https://github.com/openfspht/demo/commit/4356ff31073dd3a17df29b851c9dfc2380a5b050))
* align the shop copy with the specification's terms ([38adc68](https://github.com/openfspht/demo/commit/38adc68a4164bbcd2770d5c5d7f94fed72fd8dec))
* rename the demonstration shop to TiMache ([6e8e3bc](https://github.com/openfspht/demo/commit/6e8e3bca10f23e6ac74baa8d855fba06f5bc983d))


### Bug Fixes

* pin minimatch to a patched release ([2ab92a0](https://github.com/openfspht/demo/commit/2ab92a0f6bcdfe4433eb2d1cd720ea72c8b2664f))
