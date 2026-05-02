'use server'

import { AuthError } from "next-auth"

import { signIn } from "@/auth"

export type LoginState = {
  message: string
}

const DASHBOARD_PATH = "/dashboard"

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const password = String(formData.get("password") ?? "")

  if (!email || !password) {
    return { message: "Please enter your email and password." }
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: DASHBOARD_PATH,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      if (
        error.type === "CredentialsSignin" ||
        error.type === "CallbackRouteError"
      ) {
        return { message: "Invalid email or password." }
      }

      return { message: "Unable to sign in right now. Please try again." }
    }

    throw error
  }

  return { message: "" }
}
