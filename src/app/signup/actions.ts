'use server'

import { hash } from "bcryptjs"
import { Prisma } from "@prisma/client"

import { signIn } from "@/auth"
import { prisma } from "@/lib/prisma"

export type SignupState = {
  message: string
}

const DASHBOARD_PATH = "/dashboard"

export async function createAccount(
  _prevState: SignupState,
  formData: FormData
): Promise<SignupState> {
  const name = String(formData.get("name") ?? "").trim()
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const password = String(formData.get("password") ?? "")
  const confirmPassword = String(formData.get("confirmPassword") ?? "")

  if (!name || !email || !password || !confirmPassword) {
    return { message: "Please fill in every field." }
  }

  if (password !== confirmPassword) {
    return { message: "Passwords do not match." }
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
  })

  if (existingUser) {
    return { message: "An account with this email already exists." }
  }

  try {
    const passwordHash = await hash(password, 12)

    await prisma.user.create({
      data: {
        name,
        email,
        password: passwordHash,
      },
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { message: "An account with this email already exists." }
    }

    throw error
  }

  await signIn("credentials", {
    email,
    password,
    redirectTo: DASHBOARD_PATH,
  })
  // signIn always redirects — this is unreachable
  return { message: "" }
}
