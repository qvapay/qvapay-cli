// Flujo de auth: request-pin -> (PIN por correo) -> login(remember=true) -> token.
// Estas funciones solo golpean la API; los prompts viven en los comandos/TUI.

import { api } from "./client"
import type {
  QvaPayLoginResponse,
  QvaPayRequestPinResponse,
  User,
} from "./types"

export function requestPin(
  email: string,
  password: string
): Promise<QvaPayRequestPinResponse> {
  return api<QvaPayRequestPinResponse>("/auth/request-pin", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  })
}

export function login(
  email: string,
  password: string,
  pin: string
): Promise<QvaPayLoginResponse> {
  return api<QvaPayLoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      two_factor_code: pin,
      remember: true, // token ~180 días, minimiza re-logins
    }),
  })
}

// Perfil autenticado. Incluye balance (número) y latest_transactions.
export function getUser(token: string): Promise<User> {
  return api<User>("/user", { token })
}
