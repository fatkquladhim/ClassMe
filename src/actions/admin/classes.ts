"use server";

import prisma from "@/lib/prisma";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";

// Type conversion helpers
type PrismaSemesterType = "GANJIL" | "GENAP";

function semesterTypeToLowercase(type: PrismaSemesterType): "ganjil" | "genap" {
  return type.toLowerCase() as "ganjil" | "genap";
}

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

  const classes = await prisma.class.findMany({
    where: semesterId ? { semesterId } : undefined,
    include: {
      semester: {
        select: { type: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return classes.map((cls: typeof classes[number]) => ({
    id: cls.id,
    name: cls.name,
    code: cls.code,
    description: cls.description,
    maxStudents: cls.maxStudents,
    isActive: cls.isActive,
    semesterId: cls.semesterId,
    semesterType: semesterTypeToLowercase(cls.semester.type as PrismaSemesterType),
    createdAt: cls.createdAt,
  }));
}

export async function getClassById(id: string) {
  await requireRole(["admin"]);

  const cls = await prisma.class.findUnique({
    where: { id },
    include: {
      groups: {
        orderBy: { groupNumber: "asc" },
      },
      fanIlmu: true,
      _count: {
        select: {
          enrollments: {
            where: { status: "ACTIVE" },
          },
        },
      },
    },
  });

  if (!cls) return null;

  return {
    id: cls.id,
    name: cls.name,
    code: cls.code,
    semesterId: cls.semesterId,
    description: cls.description,
    maxStudents: cls.maxStudents,
    isActive: cls.isActive,
    createdAt: cls.createdAt,
    updatedAt: cls.updatedAt,
    enrollmentCount: cls._count.enrollments,
    groups: cls.groups,
    fanIlmu: cls.fanIlmu,
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
    await prisma.class.create({
      data: {
        name,
        code,
        semesterId,
        description,
        maxStudents,
      },
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
    await prisma.class.update({
      where: { id },
      data: {
        name,
        code,
        semesterId,
        description,
        maxStudents,
        isActive,
      },
    });

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
    await prisma.class.delete({
      where: { id },
    });

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
    const existing = await prisma.classEnrollment.findFirst({
      where: {
        userId,
        classId,
        semesterId,
      },
    });

    if (existing) {
      return { errors: { general: ["Mahasiswa sudah terdaftar di kelas ini"] } };
    }

    await prisma.classEnrollment.create({
      data: {
        userId,
        classId,
        semesterId,
        status: "ACTIVE",
      },
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
    await prisma.classEnrollment.delete({
      where: { id: enrollmentId },
    });

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
    await prisma.group.create({
      data: {
        classId,
        name,
        groupNumber,
      },
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
    await prisma.fanIlmu.create({
      data: {
        classId,
        name,
        description,
      },
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
  const enrolled = await prisma.classEnrollment.findMany({
    where: {
      classId,
      semesterId,
    },
    select: { userId: true },
  });

  const enrolledIds = enrolled.map((e: { userId: string }) => e.userId);

  const students = await prisma.user.findMany({
    where: {
      userType: "MAHASISWA",
      isActive: true,
      id: {
        notIn: enrolledIds.length > 0 ? enrolledIds : [""],
      },
    },
    orderBy: { name: "asc" },
  });

  return students;
}

// Get class enrollments with user details
export async function getClassEnrollments(classId: string) {
  await requireRole(["admin"]);

  const enrollments = await prisma.classEnrollment.findMany({
    where: { classId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      user: { name: "asc" },
    },
  });

  return enrollments.map((e: typeof enrollments[number]) => ({
    id: e.id,
    userId: e.userId,
    userName: e.user.name,
    userEmail: e.user.email,
    status: e.status.toLowerCase(),
    enrolledAt: e.enrolledAt,
  }));
}

// Get semesters for dropdown
export async function getSemesters() {
  await requireRole(["admin"]);

  const semesters = await prisma.semester.findMany({
    include: {
      academicYear: {
        select: { name: true },
      },
    },
    orderBy: [
      { academicYear: { startDate: "desc" } },
      { startDate: "desc" },
    ],
  });

  return semesters.map((s: typeof semesters[number]) => ({
    id: s.id,
    type: semesterTypeToLowercase(s.type as PrismaSemesterType),
    academicYearName: s.academicYear.name,
    isActive: s.isActive,
    label: `${s.academicYear.name} - ${s.type}`,
  }));
}
