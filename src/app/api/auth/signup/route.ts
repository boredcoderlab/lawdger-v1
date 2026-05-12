import { NextResponse } from "next/server"
import { hash } from "bcryptjs"
import { z } from "zod"
import { prisma } from "@/lib/prisma"

const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

type SignupInput = z.infer<typeof signupSchema>

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json()
    const result = signupSchema.safeParse(body)

    if (!result.success) {
      const message = result.error.issues[0]?.message ?? "Invalid input"
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const { name, email, password }: SignupInput = result.data

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 400 })
    }

    const hashedPassword = await hash(password, 10)
    await prisma.user.create({ data: { name, email, password: hashedPassword } })

    return NextResponse.json({ success: true }, { status: 201 })
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    )
  }
}
