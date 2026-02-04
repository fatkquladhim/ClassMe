import { db } from "@/lib/db";
import {
  dosenPrivileges,
  mahasiswaPrivileges,
  classEnrollments,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export type DosenPrivilegeType =
  | "dosen_pendamping"
  | "wali_kelas"
  | "pengurus_hafalan"
  | "pengurus_capaian_materi"
  | "pengurus_kelas";

export type MahasiswaPrivilegeType =
  | "ketua_umum"
  | "ketua_kelompok"
  | "kamtib"
  | "ketua_fan_ilmu"
  | "sekretaris"
  | "bendahara";

// Check if a dosen has a specific privilege for a class
export async function hasDosenPrivilege(
  userId: string,
  classId: string,
  privilegeType: DosenPrivilegeType
): Promise<boolean> {
  const [privilege] = await db
    .select()
    .from(dosenPrivileges)
    .where(
      and(
        eq(dosenPrivileges.userId, userId),
        eq(dosenPrivileges.classId, classId),
        eq(dosenPrivileges.privilegeType, privilegeType)
      )
    )
    .limit(1);

  return !!privilege;
}

// Check if a dosen has any privilege for a class
export async function hasAnyDosenPrivilege(
  userId: string,
  classId: string
): Promise<boolean> {
  const [privilege] = await db
    .select()
    .from(dosenPrivileges)
    .where(
      and(
        eq(dosenPrivileges.userId, userId),
        eq(dosenPrivileges.classId, classId)
      )
    )
    .limit(1);

  return !!privilege;
}

// Get all dosen privileges for a class
export async function getDosenPrivilegesForClass(
  userId: string,
  classId: string
): Promise<DosenPrivilegeType[]> {
  const privileges = await db
    .select({ privilegeType: dosenPrivileges.privilegeType })
    .from(dosenPrivileges)
    .where(
      and(
        eq(dosenPrivileges.userId, userId),
        eq(dosenPrivileges.classId, classId)
      )
    );

  return privileges.map((p) => p.privilegeType);
}

// Check if a mahasiswa has a specific privilege for a class
export async function hasMahasiswaPrivilege(
  userId: string,
  classId: string,
  privilegeType: MahasiswaPrivilegeType
): Promise<boolean> {
  // First get the enrollment
  const [enrollment] = await db
    .select()
    .from(classEnrollments)
    .where(
      and(
        eq(classEnrollments.userId, userId),
        eq(classEnrollments.classId, classId),
        eq(classEnrollments.status, "active")
      )
    )
    .limit(1);

  if (!enrollment) {
    return false;
  }

  const [privilege] = await db
    .select()
    .from(mahasiswaPrivileges)
    .where(
      and(
        eq(mahasiswaPrivileges.enrollmentId, enrollment.id),
        eq(mahasiswaPrivileges.classId, classId),
        eq(mahasiswaPrivileges.privilegeType, privilegeType)
      )
    )
    .limit(1);

  return !!privilege;
}

// Check if a mahasiswa is ketua umum
export async function isKetuaUmum(
  userId: string,
  classId: string
): Promise<boolean> {
  return hasMahasiswaPrivilege(userId, classId, "ketua_umum");
}

// Get all mahasiswa privileges for a class
export async function getMahasiswaPrivilegesForClass(
  userId: string,
  classId: string
): Promise<MahasiswaPrivilegeType[]> {
  const [enrollment] = await db
    .select()
    .from(classEnrollments)
    .where(
      and(
        eq(classEnrollments.userId, userId),
        eq(classEnrollments.classId, classId),
        eq(classEnrollments.status, "active")
      )
    )
    .limit(1);

  if (!enrollment) {
    return [];
  }

  const privileges = await db
    .select({ privilegeType: mahasiswaPrivileges.privilegeType })
    .from(mahasiswaPrivileges)
    .where(
      and(
        eq(mahasiswaPrivileges.enrollmentId, enrollment.id),
        eq(mahasiswaPrivileges.classId, classId)
      )
    );

  return privileges.map((p) => p.privilegeType);
}

// Check if user is enrolled in a class
export async function isEnrolledInClass(
  userId: string,
  classId: string
): Promise<boolean> {
  const [enrollment] = await db
    .select()
    .from(classEnrollments)
    .where(
      and(
        eq(classEnrollments.userId, userId),
        eq(classEnrollments.classId, classId),
        eq(classEnrollments.status, "active")
      )
    )
    .limit(1);

  return !!enrollment;
}

// Get enrollment ID for a user in a class
export async function getEnrollmentId(
  userId: string,
  classId: string
): Promise<string | null> {
  const [enrollment] = await db
    .select({ id: classEnrollments.id })
    .from(classEnrollments)
    .where(
      and(
        eq(classEnrollments.userId, userId),
        eq(classEnrollments.classId, classId),
        eq(classEnrollments.status, "active")
      )
    )
    .limit(1);

  return enrollment?.id || null;
}

// Permission check helpers for common operations
export const permissions = {
  // Can manage hafalan records
  canManageHafalan: async (userId: string, classId: string) => {
    return hasDosenPrivilege(userId, classId, "pengurus_hafalan");
  },

  // Can manage material achievements
  canManageMaterialAchievements: async (userId: string, classId: string) => {
    return hasDosenPrivilege(userId, classId, "pengurus_capaian_materi");
  },

  // Can evaluate class
  canEvaluateClass: async (userId: string, classId: string) => {
    const isWaliKelas = await hasDosenPrivilege(userId, classId, "wali_kelas");
    const isPengurusKelas = await hasDosenPrivilege(
      userId,
      classId,
      "pengurus_kelas"
    );
    return isWaliKelas || isPengurusKelas;
  },

  // Can manage attendance
  canManageAttendance: async (userId: string, classId: string) => {
    const isWaliKelas = await hasDosenPrivilege(userId, classId, "wali_kelas");
    const isPendamping = await hasDosenPrivilege(
      userId,
      classId,
      "dosen_pendamping"
    );
    const isPengurusKelas = await hasDosenPrivilege(
      userId,
      classId,
      "pengurus_kelas"
    );
    const isKetuaUmumUser = await isKetuaUmum(userId, classId);
    return isWaliKelas || isPendamping || isPengurusKelas || isKetuaUmumUser;
  },

  // Can assign mahasiswa privileges (only ketua umum)
  canAssignMahasiswaPrivileges: async (userId: string, classId: string) => {
    return isKetuaUmum(userId, classId);
  },

  // Can manage groups (wali kelas or ketua umum)
  canManageGroups: async (userId: string, classId: string) => {
    const isWaliKelas = await hasDosenPrivilege(userId, classId, "wali_kelas");
    const isKetuaUmumUser = await isKetuaUmum(userId, classId);
    return isWaliKelas || isKetuaUmumUser;
  },
};
