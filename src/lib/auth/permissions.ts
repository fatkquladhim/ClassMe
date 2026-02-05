import prisma from "@/lib/prisma";

// Prisma enum types mapped to lowercase for API compatibility
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

// Prisma enum values (uppercase)
type PrismaDosenPrivilegeType =
  | "DOSEN_PENDAMPING"
  | "WALI_KELAS"
  | "PENGURUS_HAFALAN"
  | "PENGURUS_CAPAIAN_MATERI"
  | "PENGURUS_KELAS";

type PrismaMahasiswaPrivilegeType =
  | "KETUA_UMUM"
  | "KETUA_KELOMPOK"
  | "KAMTIB"
  | "KETUA_FAN_ILMU"
  | "SEKRETARIS"
  | "BENDAHARA";

// Helper functions for enum conversion
function toDosenPrismaEnum(type: DosenPrivilegeType): PrismaDosenPrivilegeType {
  return type.toUpperCase() as PrismaDosenPrivilegeType;
}

function fromDosenPrismaEnum(type: PrismaDosenPrivilegeType): DosenPrivilegeType {
  return type.toLowerCase() as DosenPrivilegeType;
}

function fromMahasiswaPrismaEnum(type: PrismaMahasiswaPrivilegeType): MahasiswaPrivilegeType {
  return type.toLowerCase() as MahasiswaPrivilegeType;
}

function toMahasiswaPrismaEnum(type: MahasiswaPrivilegeType): PrismaMahasiswaPrivilegeType {
  return type.toUpperCase() as PrismaMahasiswaPrivilegeType;
}

// Check if a dosen has a specific privilege for a class
export async function hasDosenPrivilege(
  userId: string,
  classId: string,
  privilegeType: DosenPrivilegeType
): Promise<boolean> {
  const privilege = await prisma.dosenPrivilege.findFirst({
    where: {
      userId,
      classId,
      privilegeType: toDosenPrismaEnum(privilegeType),
    },
  });

  return !!privilege;
}

// Check if a dosen has any privilege for a class
export async function hasAnyDosenPrivilege(
  userId: string,
  classId: string
): Promise<boolean> {
  const privilege = await prisma.dosenPrivilege.findFirst({
    where: {
      userId,
      classId,
    },
  });

  return !!privilege;
}

// Get all dosen privileges for a class
export async function getDosenPrivilegesForClass(
  userId: string,
  classId: string
): Promise<DosenPrivilegeType[]> {
  const privileges = await prisma.dosenPrivilege.findMany({
    where: {
      userId,
      classId,
    },
    select: {
      privilegeType: true,
    },
  });

  return privileges.map((p: { privilegeType: PrismaDosenPrivilegeType }) => fromDosenPrismaEnum(p.privilegeType));
}

// Check if a mahasiswa has a specific privilege for a class
export async function hasMahasiswaPrivilege(
  userId: string,
  classId: string,
  privilegeType: MahasiswaPrivilegeType
): Promise<boolean> {
  // First get the enrollment
  const enrollment = await prisma.classEnrollment.findFirst({
    where: {
      userId,
      classId,
      status: "ACTIVE",
    },
  });

  if (!enrollment) {
    return false;
  }

  const privilege = await prisma.mahasiswaPrivilege.findFirst({
    where: {
      enrollmentId: enrollment.id,
      classId,
      privilegeType: toMahasiswaPrismaEnum(privilegeType),
    },
  });

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
  const enrollment = await prisma.classEnrollment.findFirst({
    where: {
      userId,
      classId,
      status: "ACTIVE",
    },
  });

  if (!enrollment) {
    return [];
  }

  const privileges = await prisma.mahasiswaPrivilege.findMany({
    where: {
      enrollmentId: enrollment.id,
      classId,
    },
    select: {
      privilegeType: true,
    },
  });

  return privileges.map((p: { privilegeType: PrismaMahasiswaPrivilegeType }) => fromMahasiswaPrismaEnum(p.privilegeType));
}

// Check if user is enrolled in a class
export async function isEnrolledInClass(
  userId: string,
  classId: string
): Promise<boolean> {
  const enrollment = await prisma.classEnrollment.findFirst({
    where: {
      userId,
      classId,
      status: "ACTIVE",
    },
  });

  return !!enrollment;
}

// Get enrollment ID for a user in a class
export async function getEnrollmentId(
  userId: string,
  classId: string
): Promise<string | null> {
  const enrollment = await prisma.classEnrollment.findFirst({
    where: {
      userId,
      classId,
      status: "ACTIVE",
    },
    select: {
      id: true,
    },
  });

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
