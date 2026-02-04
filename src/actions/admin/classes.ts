"use server";

import { db } from "@/lib/db";
import {
  classes,
  classEnrollments,
  groups,
  fanIlmu,
  semesters,
  users,
} from "@/lib/db/schema";
import { eq, and, count } from "drizzle-orm";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";

// Validation schemas
const createClassSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter"),
  code: z.string().min(2, "Kode minimal 2 karakter"),
  semesterId: z.string().uuid("Semester tidak valid"),
  description: z.string().optional(),
  maxStudents: z.number().int().positive().default(30),
});

const updateClassSchema = createClassSchema.extend({
  id: z.string().uuid(),
  isActive: z.boolean(),
});

export type ClassFormState = {
  errors?: Record<string, string[]>;
  success?: boolean;
  message?: string;
};

export async function getClasses(semesterId?: string) {
  await requireRole(["admin"]);

  const query = db
    .select({
      id: classes.id,
      name: classes.name,
      code: classes.code,
      description: classes.description,
      maxStudents: classes.maxStudents,
      isActive: classes.isActive,
      semesterId: classes.semesterId,
      semesterType: semesters.type,
      createdAt: classes.createdAt,
    })
    .from(classes)
    .innerJoin(semesters, eq(classes.semesterId, semesters.id))
    .orderBy(classes.name);

  if (semesterId) {
    return query.where(eq(classes.semesterId, semesterId));
  }

  return query;
}

export async function getClassById(id: string) {
  await requireRole(["admin"]);

  const [cls] = await db
    .select()
    .from(classes)
    .where(eq(classes.id, id))
    .limit(1);

  if (!cls) return null;

  // Get enrollment count
  const [enrollmentCount] = await db
    .select({ count: count() })
    .from(classEnrollments)
    .where(
      and(
        eq(classEnrollments.classId, id),
        eq(classEnrollments.status, "active")
      )
    );

  // Get groups
  const classGroups = await db
    .select()
    .from(groups)
    .where(eq(groups.classId, id))
    .orderBy(groups.groupNumber);

  // Get fan ilmu
  const classFanIlmu = await db
    .select()
    .from(fanIlmu)
    .where(eq(fanIlmu.classId, id));

  return {
    ...cls,
    enrollmentCount: enrollmentCount?.count || 0,
    groups: classGroups,
    fanIlmu: classFanIlmu,
  };
}

export async function createClass(
  prevState: ClassFormState,
  formData: FormData
): Promise<ClassFormState> {
  try {
    await requireRole(["admin"]);
  } catch {
    return { errors: { general: ["Unauthorized"] } };
  }

  const validatedFields = createClassSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    semesterId: formData.get("semesterId"),
    description: formData.get("description") || undefined,
    maxStudents: parseInt(formData.get("maxStudents") as string) || 30,
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { name, code, semesterId, description, maxStudents } =
    validatedFields.data;

  try {
    await db.insert(classes).values({
      name,
      code,
      semesterId,
      description,
      maxStudents,
    });

    revalidatePath("/admin/classes");
    return { success: true, message: "Kelas berhasil ditambahkan" };
  } catch (error) {
    console.error("Create class error:", error);
    return { errors: { general: ["Gagal menambahkan kelas"] } };
  }
}

export async function updateClass(
  prevState: ClassFormState,
  formData: FormData
): Promise<ClassFormState> {
  try {
    await requireRole(["admin"]);
  } catch {
    return { errors: { general: ["Unauthorized"] } };
  }

  const validatedFields = updateClassSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    code: formData.get("code"),
    semesterId: formData.get("semesterId"),
    description: formData.get("description") || undefined,
    maxStudents: parseInt(formData.get("maxStudents") as string) || 30,
    isActive: formData.get("isActive") === "true",
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { id, name, code, semesterId, description, maxStudents, isActive } =
    validatedFields.data;

  try {
    await db
      .update(classes)
      .set({
        name,
        code,
        semesterId,
        description,
        maxStudents,
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(classes.id, id));

    revalidatePath("/admin/classes");
    return { success: true, message: "Kelas berhasil diperbarui" };
  } catch (error) {
    console.error("Update class error:", error);
    return { errors: { general: ["Gagal memperbarui kelas"] } };
  }
}

export async function deleteClass(id: string): Promise<ClassFormState> {
  try {
    await requireRole(["admin"]);
  } catch {
    return { errors: { general: ["Unauthorized"] } };
  }

  try {
    await db.delete(classes).where(eq(classes.id, id));
    revalidatePath("/admin/classes");
    return { success: true, message: "Kelas berhasil dihapus" };
  } catch (error) {
    console.error("Delete class error:", error);
    return { errors: { general: ["Gagal menghapus kelas"] } };
  }
}

// Enrollment management
export async function enrollStudent(
  classId: string,
  userId: string,
  semesterId: string
): Promise<ClassFormState> {
  try {
    await requireRole(["admin"]);
  } catch {
    return { errors: { general: ["Unauthorized"] } };
  }

  try {
    // Check if already enrolled
    const [existing] = await db
      .select()
      .from(classEnrollments)
      .where(
        and(
          eq(classEnrollments.userId, userId),
          eq(classEnrollments.classId, classId),
          eq(classEnrollments.semesterId, semesterId)
        )
      )
      .limit(1);

    if (existing) {
      return { errors: { general: ["Mahasiswa sudah terdaftar di kelas ini"] } };
    }

    await db.insert(classEnrollments).values({
      userId,
      classId,
      semesterId,
      status: "active",
    });

    revalidatePath(`/admin/classes/${classId}`);
    return { success: true, message: "Mahasiswa berhasil didaftarkan" };
  } catch (error) {
    console.error("Enroll student error:", error);
    return { errors: { general: ["Gagal mendaftarkan mahasiswa"] } };
  }
}

export async function removeEnrollment(
  enrollmentId: string
): Promise<ClassFormState> {
  try {
    await requireRole(["admin"]);
  } catch {
    return { errors: { general: ["Unauthorized"] } };
  }

  try {
    await db.delete(classEnrollments).where(eq(classEnrollments.id, enrollmentId));
    revalidatePath("/admin/classes");
    return { success: true, message: "Enrollment berhasil dihapus" };
  } catch (error) {
    console.error("Remove enrollment error:", error);
    return { errors: { general: ["Gagal menghapus enrollment"] } };
  }
}

// Group management
export async function createGroup(
  classId: string,
  name: string,
  groupNumber: number
): Promise<ClassFormState> {
  try {
    await requireRole(["admin"]);
  } catch {
    return { errors: { general: ["Unauthorized"] } };
  }

  try {
    await db.insert(groups).values({
      classId,
      name,
      groupNumber,
    });

    revalidatePath(`/admin/classes/${classId}`);
    return { success: true, message: "Kelompok berhasil ditambahkan" };
  } catch (error) {
    console.error("Create group error:", error);
    return { errors: { general: ["Gagal menambahkan kelompok"] } };
  }
}

// Fan Ilmu management
export async function createFanIlmu(
  classId: string,
  name: string,
  description?: string
): Promise<ClassFormState> {
  try {
    await requireRole(["admin"]);
  } catch {
    return { errors: { general: ["Unauthorized"] } };
  }

  try {
    await db.insert(fanIlmu).values({
      classId,
      name,
      description,
    });

    revalidatePath(`/admin/classes/${classId}`);
    return { success: true, message: "Fan Ilmu berhasil ditambahkan" };
  } catch (error) {
    console.error("Create fan ilmu error:", error);
    return { errors: { general: ["Gagal menambahkan fan ilmu"] } };
  }
}

// Get available students for enrollment
export async function getAvailableStudents(classId: string, semesterId: string) {
  await requireRole(["admin"]);

  // Get students not enrolled in this class for this semester
  const enrolled = await db
    .select({ userId: classEnrollments.userId })
    .from(classEnrollments)
    .where(
      and(
        eq(classEnrollments.classId, classId),
        eq(classEnrollments.semesterId, semesterId)
      )
    );

  const enrolledIds = enrolled.map((e) => e.userId);

  const students = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.userType, "mahasiswa"),
        eq(users.isActive, true)
      )
    )
    .orderBy(users.name);

  return students.filter((s) => !enrolledIds.includes(s.id));
}

// Get class enrollments with user details
export async function getClassEnrollments(classId: string) {
  await requireRole(["admin"]);

  return db
    .select({
      id: classEnrollments.id,
      userId: classEnrollments.userId,
      userName: users.name,
      userEmail: users.email,
      status: classEnrollments.status,
      enrolledAt: classEnrollments.enrolledAt,
    })
    .from(classEnrollments)
    .innerJoin(users, eq(classEnrollments.userId, users.id))
    .where(eq(classEnrollments.classId, classId))
    .orderBy(users.name);
}
