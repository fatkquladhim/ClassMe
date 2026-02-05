"use server";

import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { requireRole, stringToUserType } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";

// User type conversion helpers
type PrismaUserType = "ADMIN" | "DOSEN" | "MAHASISWA";

function userTypeToLowercase(userType: PrismaUserType): "admin" | "dosen" | "mahasiswa" {
  return userType.toLowerCase() as "admin" | "dosen" | "mahasiswa";
}

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

// User type for exports
export type User = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  phone: string | null;
  photoUrl: string | null;
  userType: "admin" | "dosen" | "mahasiswa";
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export async function getUsers(): Promise<User[]> {
  await requireRole(["admin"]);

  const dbUsers = await prisma.user.findMany({
    orderBy: { name: "asc" },
  });

  return dbUsers.map((user: {
    id: string;
    email: string;
    name: string;
    passwordHash: string;
    phone: string | null;
    photoUrl: string | null;
    userType: PrismaUserType;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) => ({
    ...user,
    userType: userTypeToLowercase(user.userType),
  }));
}

export async function getUserById(id: string): Promise<User | null> {
  await requireRole(["admin"]);

  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) return null;

  return {
    ...user,
    userType: userTypeToLowercase(user.userType as PrismaUserType),
  };
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
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existing) {
      return { errors: { email: ["Email sudah terdaftar"] } };
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash,
        userType: stringToUserType(userType),
        phone,
      },
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
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existing && existing.id !== id) {
      return { errors: { email: ["Email sudah digunakan pengguna lain"] } };
    }

    await prisma.user.update({
      where: { id },
      data: {
        name,
        email: email.toLowerCase(),
        userType: stringToUserType(userType),
        phone,
        isActive,
      },
    });

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
    await prisma.user.delete({
      where: { id },
    });

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
    await prisma.user.update({
      where: { id },
      data: { isActive },
    });

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
