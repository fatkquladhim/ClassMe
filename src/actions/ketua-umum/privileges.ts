"use server";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { isKetuaUmum, getEnrollmentId } from "@/lib/auth/permissions";
import { revalidatePath } from "next/cache";

// Type helpers
type PrismaMahasiswaPrivilegeType =
  | "KETUA_UMUM"
  | "KETUA_KELOMPOK"
  | "KAMTIB"
  | "KETUA_FAN_ILMU"
  | "SEKRETARIS"
  | "BENDAHARA";

type MahasiswaPrivilegeType =
  | "ketua_kelompok"
  | "kamtib"
  | "ketua_fan_ilmu"
  | "sekretaris"
  | "bendahara";

function toMahasiswaPrismaEnum(type: string): PrismaMahasiswaPrivilegeType {
  return type.toUpperCase() as PrismaMahasiswaPrivilegeType;
}

function fromMahasiswaPrismaEnum(type: PrismaMahasiswaPrivilegeType): string {
  return type.toLowerCase();
}

export type PrivilegeFormState = {
  errors?: Record<string, string[]>;
  success?: boolean;
  message?: string;
};

// Verify user is ketua umum for the class
async function verifyKetuaUmum(classId: string) {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const isKU = await isKetuaUmum(session.user.id, classId);
  if (!isKU) {
    throw new Error("Forbidden - Only Ketua Umum can perform this action");
  }

  return session;
}

// Get all mahasiswa in the class with their privileges
export async function getClassMembersWithPrivileges(classId: string) {
  await verifyKetuaUmum(classId);

  const enrollments = await prisma.classEnrollment.findMany({
    where: {
      classId,
      status: "ACTIVE",
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      privileges: {
        select: {
          enrollmentId: true,
          privilegeType: true,
          groupId: true,
          fanIlmuId: true,
        },
      },
    },
    orderBy: {
      user: { name: "asc" },
    },
  });

  // Get groups and fan ilmu for reference
  const classGroups = await prisma.group.findMany({
    where: { classId },
  });

  const classFanIlmu = await prisma.fanIlmu.findMany({
    where: { classId },
  });

  return {
    members: enrollments.map((e: typeof enrollments[number]) => ({
      enrollmentId: e.id,
      userId: e.userId,
      userName: e.user.name,
      userEmail: e.user.email,
      privileges: e.privileges.map((p: typeof e.privileges[number]) => ({
        enrollmentId: p.enrollmentId,
        privilegeType: fromMahasiswaPrismaEnum(p.privilegeType as PrismaMahasiswaPrivilegeType),
        groupId: p.groupId,
        fanIlmuId: p.fanIlmuId,
      })),
    })),
    groups: classGroups,
    fanIlmu: classFanIlmu,
  };
}

// Assign mahasiswa privilege (by Ketua Umum)
export async function assignMahasiswaPrivilege(
  classId: string,
  targetUserId: string,
  privilegeType: MahasiswaPrivilegeType,
  options?: { groupId?: string; fanIlmuId?: string }
): Promise<PrivilegeFormState> {
  let session;
  try {
    session = await verifyKetuaUmum(classId);
  } catch (error) {
    return { errors: { general: [(error as Error).message] } };
  }

  try {
    // Get target enrollment
    const enrollmentId = await getEnrollmentId(targetUserId, classId);
    if (!enrollmentId) {
      return { errors: { general: ["Mahasiswa tidak terdaftar di kelas ini"] } };
    }

    // Validate specific privileges
    if (privilegeType === "ketua_kelompok" && !options?.groupId) {
      return { errors: { general: ["Kelompok harus dipilih untuk Ketua Kelompok"] } };
    }

    if (privilegeType === "ketua_fan_ilmu" && !options?.fanIlmuId) {
      return { errors: { general: ["Fan Ilmu harus dipilih untuk Ketua Fan Ilmu"] } };
    }

    // For unique roles (sekretaris, bendahara, kamtib), remove existing
    if (["sekretaris", "bendahara", "kamtib"].includes(privilegeType)) {
      await prisma.mahasiswaPrivilege.deleteMany({
        where: {
          classId,
          privilegeType: toMahasiswaPrismaEnum(privilegeType),
        },
      });
    }

    // For ketua kelompok, remove existing for that group
    if (privilegeType === "ketua_kelompok" && options?.groupId) {
      await prisma.mahasiswaPrivilege.deleteMany({
        where: {
          classId,
          privilegeType: "KETUA_KELOMPOK",
          groupId: options.groupId,
        },
      });
    }

    // For ketua fan ilmu, remove existing for that fan ilmu
    if (privilegeType === "ketua_fan_ilmu" && options?.fanIlmuId) {
      await prisma.mahasiswaPrivilege.deleteMany({
        where: {
          classId,
          privilegeType: "KETUA_FAN_ILMU",
          fanIlmuId: options.fanIlmuId,
        },
      });
    }

    // Assign privilege
    await prisma.mahasiswaPrivilege.create({
      data: {
        enrollmentId,
        classId,
        privilegeType: toMahasiswaPrismaEnum(privilegeType),
        groupId: options?.groupId,
        fanIlmuId: options?.fanIlmuId,
        assignedBy: session.user.id,
      },
    });

    revalidatePath(`/mahasiswa/privileges`);
    return { success: true, message: "Privilege berhasil diberikan" };
  } catch (error) {
    console.error("Assign mahasiswa privilege error:", error);
    return { errors: { general: ["Gagal memberikan privilege"] } };
  }
}

// Remove mahasiswa privilege
export async function removeMahasiswaPrivilege(
  classId: string,
  enrollmentId: string,
  privilegeType: string
): Promise<PrivilegeFormState> {
  try {
    await verifyKetuaUmum(classId);
  } catch (error) {
    return { errors: { general: [(error as Error).message] } };
  }

  try {
    // Cannot remove ketua_umum (only admin can)
    if (privilegeType === "ketua_umum") {
      return { errors: { general: ["Tidak dapat menghapus privilege Ketua Umum"] } };
    }

    await prisma.mahasiswaPrivilege.deleteMany({
      where: {
        enrollmentId,
        classId,
        privilegeType: toMahasiswaPrismaEnum(privilegeType),
      },
    });

    revalidatePath(`/mahasiswa/privileges`);
    return { success: true, message: "Privilege berhasil dihapus" };
  } catch (error) {
    console.error("Remove mahasiswa privilege error:", error);
    return { errors: { general: ["Gagal menghapus privilege"] } };
  }
}

// Get privilege summary for a class
export async function getClassPrivilegeSummary(classId: string) {
  await verifyKetuaUmum(classId);

  const privileges = await prisma.mahasiswaPrivilege.findMany({
    where: { classId },
    include: {
      enrollment: {
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  const classGroups = await prisma.group.findMany({
    where: { classId },
  });

  const classFanIlmu = await prisma.fanIlmu.findMany({
    where: { classId },
  });

  type MappedPrivilege = {
    privilegeType: string;
    userName: string;
    groupId: string | null;
    fanIlmuId: string | null;
  };

  const mappedPrivileges: MappedPrivilege[] = privileges.map((p: typeof privileges[number]) => ({
    privilegeType: fromMahasiswaPrismaEnum(p.privilegeType as PrismaMahasiswaPrivilegeType),
    userName: p.enrollment.user.name,
    groupId: p.groupId,
    fanIlmuId: p.fanIlmuId,
  }));

  return {
    ketuaUmum: mappedPrivileges.find((p: MappedPrivilege) => p.privilegeType === "ketua_umum"),
    sekretaris: mappedPrivileges.find((p: MappedPrivilege) => p.privilegeType === "sekretaris"),
    bendahara: mappedPrivileges.find((p: MappedPrivilege) => p.privilegeType === "bendahara"),
    kamtib: mappedPrivileges.find((p: MappedPrivilege) => p.privilegeType === "kamtib"),
    ketuaKelompok: mappedPrivileges
      .filter((p: MappedPrivilege) => p.privilegeType === "ketua_kelompok")
      .map((p: MappedPrivilege) => ({
        ...p,
        group: classGroups.find((g: typeof classGroups[number]) => g.id === p.groupId),
      })),
    ketuaFanIlmu: mappedPrivileges
      .filter((p: MappedPrivilege) => p.privilegeType === "ketua_fan_ilmu")
      .map((p: MappedPrivilege) => ({
        ...p,
        fanIlmu: classFanIlmu.find((f: typeof classFanIlmu[number]) => f.id === p.fanIlmuId),
      })),
  };
}
