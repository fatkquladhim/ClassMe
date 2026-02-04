"use server";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";

// Validation schemas
const createUserSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter"),
  email: z.string().email("Email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
  userType: z.enum(["admin", "dosen", "mahasiswa"]),
  phone: z.string().optional(),
});

const updateUserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2, "Nama minimal 2 karakter"),
  email: z.string().email("Email tidak valid"),
  userType: z.enum(["admin", "dosen", "mahasiswa"]),
  phone: z.string().optional(),
  isActive: z.boolean(),
});

export type UserFormState = {
  errors?: Record<string, string[]>;
  success?: boolean;
  message?: string;
};

export async function getUsers() {
  await requireRole(["admin"]);

  return db.select().from(users).orderBy(users.name);
}

export async function getUserById(id: string) {
  await requireRole(["admin"]);

  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user || null;
}

export async function createUser(
  prevState: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  try {
    await requireRole(["admin"]);
  } catch {
    return { errors: { general: ["Unauthorized"] } };
  }

  const validatedFields = createUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    userType: formData.get("userType"),
    phone: formData.get("phone") || undefined,
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { name, email, password, userType, phone } = validatedFields.data;

  try {
    // Check if email exists
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (existing) {
      return { errors: { email: ["Email sudah terdaftar"] } };
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await db.insert(users).values({
      name,
      email: email.toLowerCase(),
      passwordHash,
      userType,
      phone,
    });

    revalidatePath("/admin/users");
    return { success: true, message: "Pengguna berhasil ditambahkan" };
  } catch (error) {
    console.error("Create user error:", error);
    return { errors: { general: ["Gagal menambahkan pengguna"] } };
  }
}

export async function updateUser(
  prevState: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  try {
    await requireRole(["admin"]);
  } catch {
    return { errors: { general: ["Unauthorized"] } };
  }

  const validatedFields = updateUserSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    email: formData.get("email"),
    userType: formData.get("userType"),
    phone: formData.get("phone") || undefined,
    isActive: formData.get("isActive") === "true",
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { id, name, email, userType, phone, isActive } = validatedFields.data;

  try {
    // Check if email exists for other users
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (existing && existing.id !== id) {
      return { errors: { email: ["Email sudah digunakan pengguna lain"] } };
    }

    await db
      .update(users)
      .set({
        name,
        email: email.toLowerCase(),
        userType,
        phone,
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));

    revalidatePath("/admin/users");
    return { success: true, message: "Pengguna berhasil diperbarui" };
  } catch (error) {
    console.error("Update user error:", error);
    return { errors: { general: ["Gagal memperbarui pengguna"] } };
  }
}

export async function deleteUser(id: string): Promise<UserFormState> {
  try {
    await requireRole(["admin"]);
  } catch {
    return { errors: { general: ["Unauthorized"] } };
  }

  try {
    await db.delete(users).where(eq(users.id, id));
    revalidatePath("/admin/users");
    return { success: true, message: "Pengguna berhasil dihapus" };
  } catch (error) {
    console.error("Delete user error:", error);
    return { errors: { general: ["Gagal menghapus pengguna"] } };
  }
}

export async function toggleUserStatus(id: string, isActive: boolean): Promise<UserFormState> {
  try {
    await requireRole(["admin"]);
  } catch {
    return { errors: { general: ["Unauthorized"] } };
  }

  try {
    await db
      .update(users)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(users.id, id));

    revalidatePath("/admin/users");
    return {
      success: true,
      message: isActive ? "Pengguna diaktifkan" : "Pengguna dinonaktifkan",
    };
  } catch (error) {
    console.error("Toggle user status error:", error);
    return { errors: { general: ["Gagal mengubah status pengguna"] } };
  }
}
