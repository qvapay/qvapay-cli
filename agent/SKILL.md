---
name: qvapay
description: Operar la wallet personal de QvaPay desde la terminal con el CLI `qvapay`. Úsala para consultar balance, transacciones y usuario (lectura libre) y para transferir saldo (`send`, requiere PIN humano). Trigger cuando el usuario pida ver su saldo/movimientos de QvaPay o enviar dinero por QvaPay.
---

# QvaPay CLI

`qvapay` es un CLI para la **wallet personal de QvaPay**. Todos los comandos
aceptan `--json` para salida estable y usan **exit codes** claros. El CLI es la
fuente de verdad: si dudas, `qvapay <cmd> --help`.

## Lectura (seguro, úsalo libremente)

```
qvapay whoami --json          # usuario autenticado
qvapay balance --json         # saldo disponible
qvapay tx list --json         # transacciones (--limit 1-30, --page, --status paid|pending|cancelled)
qvapay tx get <uuid>          # detalle de una transacción (siempre JSON)
qvapay tx watch --json        # espera transacciones nuevas: NDJSON, una línea por tx
```

`tx watch` no termina solo: sondea cada 15 s (mínimo 10, `--interval <s>`) hasta
Ctrl-C. La primera pasada no imprime nada — solo registra lo que ya existía —, así
que toda línea que salga es una transacción nueva. Úsalo para esperar un cobro en
vez de repetir `tx list`.

Ejemplos de salida:

```
$ qvapay balance --json
{"balance":123.45}

$ qvapay whoami --json
{
  "uuid": "…",
  "username": "pepe",
  "name": "Pepe",
  "lastname": "Marquez",
  "email": "pepe@example.com",
  "balance": 123.45,
  "latest_transactions": [ … ]
}

$ qvapay tx list --limit 2 --json
[
  { "uuid": "…", "amount": -10, "status": "paid", "description": "Pago", "created_at": "2026-08-01T12:00:00" }
]
```

## `send` — dinero real (requiere al humano)

`qvapay send <usuario> <monto> [--note <texto>]`

**No puedes completar un `send` por tu cuenta.** Reglas:

- Exige un **PIN de seguridad** que teclea el humano por prompt oculto. El PIN
  **nunca** va por flag ni por argumento. No lo pidas ni lo pases tú.
- Hay **política local** (`send.enabled`, `maxPerTx`, `dailyCap`, `whitelist`)
  que puede bloquear la transferencia con **exit 3**.
- En entornos no interactivos (como el tuyo) `send` aborta salvo que el humano
  haya fijado `QVAPAY_ALLOW_SEND=1` y provea el PIN por stdin. Aun así,
  **pide confirmación explícita al humano antes de intentar cualquier `send`**.

Consultar/ajustar la política (esto sí es lectura/config, seguro):

```
qvapay config get maxPerTx
qvapay config set whitelist pepe,ana
```

## Exit codes

| Código | Significado |
|--------|-------------|
| 0 | OK |
| 1 | Error inesperado o cancelado |
| 2 | No autenticado → el humano debe correr `qvapay login` |
| 3 | `send` bloqueado por política (o no interactivo sin `QVAPAY_ALLOW_SEND=1`) |
| 4 | Monto inválido |
