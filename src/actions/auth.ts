"use server";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { createSession, destroySession, getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

// Validation schemas
const loginSchema = z.object({
  email: z.string().email("Email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
});

const registerSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter"),
  email: z.string().email("Email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
  confirmPassword: z.string(),
  userType: z.enum(["admin", "dosen", "mahasiswa"]),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Password tidak sama",
  path: ["confirmPassword"],
});

export type LoginFormState = {
  errors?: {
    email?: string[];
    password?: string[];
    general?: string[];
  };
  success?: boolean;
};

export type RegisterFormState = {
  errors?: {
    name?: string[];
    email?: string[];
    password?: string[];
    confirmPassword?: string[];
    userType?: string[];
    general?: string[];
  };
  success?: boolean;
};

export async function login(
  prevState: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  // Validate input
  const validatedFields = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { email, password } = validatedFields.data;

  try {
    // Find user by email
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (!user) {
      return {
        errors: {
          general: ["Email atau password salah"],
        },
      };
    }

    if (!user.isActive) {
      return {
        errors: {
          general: ["Akun Anda tidak aktif. Hubungi admin."],
        },
      };
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return {
        errors: {
          general: ["Email atau password salah"],
        },
      };
    }

    // Create session
    await createSession({
      id: user.id,
      email: user.email,
      name: user.name,
      userType: user.userType,
      photoUrl: user.photoUrl,
    });

    return { success: true };
  } catch (error) {
    console.error("Login error:", error);
    return {
      errors: {
        general: ["Terjadi kesalahan. Silakan coba lagi."],
      },
    };
  }
}

export async function register(
  prevState: RegisterFormState,
  formData: FormData
): Promise<RegisterFormState> {
  // Validate input
  const validatedFields = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    userType: formData.get("userType"),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { name, email, password, userType } = validatedFields.data;

  try {
    // Check if email already exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (existingUser) {
      return {
        errors: {
          email: ["Email sudah terdaftar"],
        },
      };
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        name,
        email: email.toLowerCase(),
        passwordHash,
        userType,
      })
      .returning();

    // Create session
    await createSession({
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      userType: newUser.userType,
      photoUrl: newUser.photoUrl,
    });

    return { success: true };
  } catch (error) {
    console.error("Register error:", error);
    return {
      errors: {
        general: ["Terjadi kesalahan. Silakan coba lagi."],
      },
    };
  }
}

export async function logout() {
  await destroySession();
  revalidatePath("/");
  redirect("/login");
}

export async function getCurrentUser() {
  const session = await getSession();
  return session?.user || null;
}

export async function redirectBasedOnRole() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  switch (session.user.userType) {
    case "admin":
      redirect("/admin");
    case "dosen":
      redirect("/dosen");
    case "mahasiswa":
      redirect("/mahasiswa");
    default:
      redirect("/login");
  }
}
