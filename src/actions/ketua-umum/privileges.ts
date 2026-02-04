"use server";

import { db } from "@/lib/db";
import {
  mahasiswaPrivileges,
  classEnrollments,
  users,
  groups,
  fanIlmu,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { isKetuaUmum, getEnrollmentId } from "@/lib/auth/permissions";
import { revalidatePath } from "next/cache";

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

  const enrollments = await db
    .select({
      enrollmentId: classEnrollments.id,
      userId: classEnrollments.userId,
      userName: users.name,
      userEmail: users.email,
    })
    .from(classEnrollments)
    .innerJoin(users, eq(classEnrollments.userId, users.id))
    .where(
      and(
        eq(classEnrollments.classId, classId),
        eq(classEnrollments.status, "active")
      )
    )
    .orderBy(users.name);

  const privileges = await db
    .select({
      enrollmentId: mahasiswaPrivileges.enrollmentId,
      privilegeType: mahasiswaPrivileges.privilegeType,
      groupId: mahasiswaPrivileges.groupId,
      fanIlmuId: mahasiswaPrivileges.fanIlmuId,
    })
    .from(mahasiswaPrivileges)
    .where(eq(mahasiswaPrivileges.classId, classId));

  // Get groups and fan ilmu for reference
  const classGroups = await db
    .select()
    .from(groups)
    .where(eq(groups.classId, classId));

  const classFanIlmu = await db
    .select()
    .from(fanIlmu)
    .where(eq(fanIlmu.classId, classId));

  return {
    members: enrollments.map((e) => ({
      ...e,
      privileges: privileges.filter((p) => p.enrollmentId === e.enrollmentId),
    })),
    groups: classGroups,
    fanIlmu: classFanIlmu,
  };
}

// Assign mahasiswa privilege (by Ketua Umum)
export async function assignMahasiswaPrivilege(
  classId: string,
  targetUserId: string,
  privilegeType: "ketua_kelompok" | "kamtib" | "ketua_fan_ilmu" | "sekretaris" | "bendahara",
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
      await db
        .delete(mahasiswaPrivileges)
        .where(
          and(
            eq(mahasiswaPrivileges.classId, classId),
            eq(mahasiswaPrivileges.privilegeType, privilegeType)
          )
        );
    }

    // For ketua kelompok, remove existing for that group
    if (privilegeType === "ketua_kelompok" && options?.groupId) {
      await db
        .delete(mahasiswaPrivileges)
        .where(
          and(
            eq(mahasiswaPrivileges.classId, classId),
            eq(mahasiswaPrivileges.privilegeType, "ketua_kelompok"),
            eq(mahasiswaPrivileges.groupId, options.groupId)
          )
        );
    }

    // For ketua fan ilmu, remove existing for that fan ilmu
    if (privilegeType === "ketua_fan_ilmu" && options?.fanIlmuId) {
      await db
        .delete(mahasiswaPrivileges)
        .where(
          and(
            eq(mahasiswaPrivileges.classId, classId),
            eq(mahasiswaPrivileges.privilegeType, "ketua_fan_ilmu"),
            eq(mahasiswaPrivileges.fanIlmuId, options.fanIlmuId)
          )
        );
    }

    // Assign privilege
    await db.insert(mahasiswaPrivileges).values({
      enrollmentId,
      classId,
      privilegeType,
      groupId: options?.groupId,
      fanIlmuId: options?.fanIlmuId,
      assignedBy: session.user.id,
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

    await db
      .delete(mahasiswaPrivileges)
      .where(
        and(
          eq(mahasiswaPrivileges.enrollmentId, enrollmentId),
          eq(mahasiswaPrivileges.classId, classId),
          eq(mahasiswaPrivileges.privilegeType, privilegeType as typeof mahasiswaPrivileges.privilegeType.enumValues[number])
        )
      );

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

  const privileges = await db
    .select({
      privilegeType: mahasiswaPrivileges.privilegeType,
      userName: users.name,
      groupId: mahasiswaPrivileges.groupId,
      fanIlmuId: mahasiswaPrivileges.fanIlmuId,
    })
    .from(mahasiswaPrivileges)
    .innerJoin(
      classEnrollments,
      eq(mahasiswaPrivileges.enrollmentId, classEnrollments.id)
    )
    .innerJoin(users, eq(classEnrollments.userId, users.id))
    .where(eq(mahasiswaPrivileges.classId, classId));

  const classGroups = await db
    .select()
    .from(groups)
    .where(eq(groups.classId, classId));

  const classFanIlmu = await db
    .select()
    .from(fanIlmu)
    .where(eq(fanIlmu.classId, classId));

  return {
    ketuaUmum: privileges.find((p) => p.privilegeType === "ketua_umum"),
    sekretaris: privileges.find((p) => p.privilegeType === "sekretaris"),
    bendahara: privileges.find((p) => p.privilegeType === "bendahara"),
    kamtib: privileges.find((p) => p.privilegeType === "kamtib"),
    ketuaKelompok: privileges
      .filter((p) => p.privilegeType === "ketua_kelompok")
      .map((p) => ({
        ...p,
        group: classGroups.find((g) => g.id === p.groupId),
      })),
    ketuaFanIlmu: privileges
      .filter((p) => p.privilegeType === "ketua_fan_ilmu")
      .map((p) => ({
        ...p,
        fanIlmu: classFanIlmu.find((f) => f.id === p.fanIlmuId),
      })),
  };
}
