"use server";

import prisma from "@/lib/prisma";
import { requireRole, getSession } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";

// Type helpers
type PrismaDosenPrivilegeType =
  | "DOSEN_PENDAMPING"
  | "WALI_KELAS"
  | "PENGURUS_HAFALAN"
  | "PENGURUS_CAPAIAN_MATERI"
  | "PENGURUS_KELAS";

type DosenPrivilegeType =
  | "dosen_pendamping"
  | "wali_kelas"
  | "pengurus_hafalan"
  | "pengurus_capaian_materi"
  | "pengurus_kelas";

function toDosenPrismaEnum(type: DosenPrivilegeType): PrismaDosenPrivilegeType {
  return type.toUpperCase() as PrismaDosenPrivilegeType;
}

function fromDosenPrismaEnum(type: PrismaDosenPrivilegeType): DosenPrivilegeType {
  return type.toLowerCase() as DosenPrivilegeType;
}

export type PrivilegeFormState = {
  errors?: Record<string, string[]>;
  success?: boolean;
  message?: string;
};

// Get all dosen with their privileges
export async function getDosenWithPrivileges() {
  await requireRole(["admin"]);

  const dosenList = await prisma.user.findMany({
    where: {
      userType: "DOSEN",
      isActive: true,
    },
    orderBy: { name: "asc" },
  });

  const privileges = await prisma.dosenPrivilege.findMany({
    include: {
      class: {
        select: { name: true },
      },
    },
  });

  // Map privileges to dosen
  const dosenWithPrivileges = dosenList.map((dosen: typeof dosenList[number]) => ({
    ...dosen,
    privileges: privileges
      .filter((p: typeof privileges[number]) => p.userId === dosen.id)
      .map((p: typeof privileges[number]) => ({
        userId: p.userId,
        classId: p.classId,
        className: p.class.name,
        privilegeType: fromDosenPrismaEnum(p.privilegeType as PrismaDosenPrivilegeType),
      })),
  }));

  return dosenWithPrivileges;
}

// Assign dosen privilege
export async function assignDosenPrivilege(
  userId: string,
  classId: string,
  privilegeType: DosenPrivilegeType
): Promise<PrivilegeFormState> {
  let session;
  try {
    session = await requireRole(["admin"]);
  } catch {
    return { errors: { general: ["Unauthorized"] } };
  }

  try {
    // Check if privilege already exists
    const existing = await prisma.dosenPrivilege.findFirst({
      where: {
        userId,
        classId,
        privilegeType: toDosenPrismaEnum(privilegeType),
      },
    });

    if (existing) {
      return { errors: { general: ["Privilege sudah diberikan"] } };
    }

    await prisma.dosenPrivilege.create({
      data: {
        userId,
        classId,
        privilegeType: toDosenPrismaEnum(privilegeType),
        assignedBy: session.user.id,
      },
    });

    revalidatePath("/admin/privileges");
    return { success: true, message: "Privilege berhasil diberikan" };
  } catch (error) {
    console.error("Assign dosen privilege error:", error);
    return { errors: { general: ["Gagal memberikan privilege"] } };
  }
}

// Remove dosen privilege
export async function removeDosenPrivilege(
  userId: string,
  classId: string,
  privilegeType: string
): Promise<PrivilegeFormState> {
  try {
    await requireRole(["admin"]);
  } catch {
    return { errors: { general: ["Unauthorized"] } };
  }

  try {
    await prisma.dosenPrivilege.deleteMany({
      where: {
        userId,
        classId,
        privilegeType: toDosenPrismaEnum(privilegeType as DosenPrivilegeType),
      },
    });

    revalidatePath("/admin/privileges");
    return { success: true, message: "Privilege berhasil dihapus" };
  } catch (error) {
    console.error("Remove dosen privilege error:", error);
    return { errors: { general: ["Gagal menghapus privilege"] } };
  }
}

// Assign Ketua Umum (admin only)
export async function assignKetuaUmum(
  userId: string,
  classId: string
): Promise<PrivilegeFormState> {
  let session;
  try {
    session = await requireRole(["admin"]);
  } catch {
    return { errors: { general: ["Unauthorized"] } };
  }

  try {
    // Get enrollment
    const enrollment = await prisma.classEnrollment.findFirst({
      where: {
        userId,
        classId,
        status: "ACTIVE",
      },
    });

    if (!enrollment) {
      return { errors: { general: ["Mahasiswa tidak terdaftar di kelas ini"] } };
    }

    // Check if there's already a ketua umum
    const existingKetuaUmum = await prisma.mahasiswaPrivilege.findFirst({
      where: {
        classId,
        privilegeType: "KETUA_UMUM",
      },
    });

    if (existingKetuaUmum) {
      // Remove existing ketua umum
      await prisma.mahasiswaPrivilege.delete({
        where: { id: existingKetuaUmum.id },
      });
    }

    // Assign new ketua umum
    await prisma.mahasiswaPrivilege.create({
      data: {
        enrollmentId: enrollment.id,
        classId,
        privilegeType: "KETUA_UMUM",
        assignedBy: session.user.id,
      },
    });

    revalidatePath("/admin/privileges");
    revalidatePath(`/admin/classes/${classId}`);
    return { success: true, message: "Ketua Umum berhasil ditunjuk" };
  } catch (error) {
    console.error("Assign ketua umum error:", error);
    return { errors: { general: ["Gagal menunjuk Ketua Umum"] } };
  }
}

// Get Ketua Umum for a class
export async function getKetuaUmum(classId: string) {
  await requireRole(["admin"]);

  const ketuaUmum = await prisma.mahasiswaPrivilege.findFirst({
    where: {
      classId,
      privilegeType: "KETUA_UMUM",
    },
    include: {
      enrollment: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!ketuaUmum) return null;

  return {
    privilegeId: ketuaUmum.id,
    enrollmentId: ketuaUmum.enrollmentId,
    userId: ketuaUmum.enrollment.user.id,
    userName: ketuaUmum.enrollment.user.name,
    userEmail: ketuaUmum.enrollment.user.email,
  };
}

// Get all classes with their ketua umum
export async function getClassesWithKetuaUmum() {
  await requireRole(["admin"]);

  const classList = await prisma.class.findMany({
    where: { isActive: true },
  });

  const ketuaUmumList = await prisma.mahasiswaPrivilege.findMany({
    where: {
      privilegeType: "KETUA_UMUM",
    },
    include: {
      enrollment: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  return classList.map((cls: typeof classList[number]) => ({
    ...cls,
    ketuaUmum: ketuaUmumList.find((ku: typeof ketuaUmumList[number]) => ku.classId === cls.id)
      ? {
          classId: cls.id,
          userId: ketuaUmumList.find((ku: typeof ketuaUmumList[number]) => ku.classId === cls.id)!.enrollment.user.id,
          userName: ketuaUmumList.find((ku: typeof ketuaUmumList[number]) => ku.classId === cls.id)!.enrollment.user.name,
        }
      : null,
  }));
}
