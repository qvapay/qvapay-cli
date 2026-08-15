# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Este proyecto sigue [SemVer](https://semver.org/lang/es/).

## [0.1.6] - 2026-08-14

### Añadido

- `qvapay tx watch`: sondea transacciones e imprime solo las nuevas hasta Ctrl-C.
  Con `--json` emite NDJSON (una línea por transacción), apto para `| jq` o para
  que un agente espere un cobro. Intervalo `--interval <s>`, con piso de 10 s por
  el rate limit del servidor (3 req / 5 s). La primera pasada solo registra lo que
  ya existía, así que toda línea impresa es una transacción nueva.

### Corregido

- Un 401 ahora borra `auth.json`. El token dura ~180 días; al caducar quedaba una
  sesión zombie en disco que solo se limpiaba con `qvapay logout` manual.
- La respuesta cruda de `/transaction/transfer` ya no se imprime en cada
  transferencia; ahora requiere `--verbose`.

### Eliminado

- `checkAuth()`, sin uso desde su introducción.

## [0.1.5] - 2026-08

- README, CONTRIBUTING y licencia MIT.

## [0.1.4] - 2026-08

- CI: se fija `npm@11` (npm@latest exige node 22+ y el runner usa node 20).
- CI: publish por OIDC / trusted publishing, gate `environment: release` con
  revisor humano y actions pineadas por SHA.

## [0.1.2] - 2026-08

- Primer release publicado en npm como `@pep3m/qvapay` (el nombre `qvapay` sin
  scope está tomado; el binario sigue llamándose `qvapay`).
- `repository.url` en package.json, requisito de la provenance de npm.
- Build unificado: bundle npm + 5 binarios compilados con `SHA256SUMS`.

## [0.1.0] - 2026-08

- Versión inicial: TUI en Ink, comandos `login`/`whoami`/`balance`/`tx`/`send`,
  política local de `send` (límites, whitelist) y skill para agentes.

[0.1.6]: https://github.com/Pep3M/qvapay-cli/releases/tag/v0.1.6
[0.1.5]: https://github.com/Pep3M/qvapay-cli/releases/tag/v0.1.5
[0.1.4]: https://github.com/Pep3M/qvapay-cli/releases/tag/v0.1.4
[0.1.2]: https://github.com/Pep3M/qvapay-cli/releases/tag/v0.1.2
[0.1.0]: https://github.com/Pep3M/qvapay-cli/releases/tag/v0.1.0
