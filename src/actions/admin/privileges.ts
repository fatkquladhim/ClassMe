"use server";

import { db } from "@/lib/db";
import {
  dosenPrivileges,
  mahasiswaPrivileges,
  users,
  classes,
  classEnrollments,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireRole, getSession } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";

export type PrivilegeFormState = {
  errors?: Record<string, string[]>;
  success?: boolean;
  message?: string;
};

// Get all dosen with their privileges
export async function getDosenWithPrivileges() {
  await requireRole(["admin"]);

  const dosenList = await db
    .select()
    .from(users)
    .where(
      and(eq(users.userType, "dosen"), eq(users.isActive, true))
    )
    .orderBy(users.name);

  const privileges = await db
    .select({
      userId: dosenPrivileges.userId,
      classId: dosenPrivileges.classId,
      className: classes.name,
      privilegeType: dosenPrivileges.privilegeType,
    })
    .from(dosenPrivileges)
    .innerJoin(classes, eq(dosenPrivileges.classId, classes.id));

  // Map privileges to dosen
  const dosenWithPrivileges = dosenList.map((dosen) => ({
    ...dosen,
    privileges: privileges.filter((p) => p.userId === dosen.id),
  }));

  return dosenWithPrivileges;
}

// Assign dosen privilege
export async function assignDosenPrivilege(
  userId: string,
  classId: string,
  privilegeType: "dosen_pendamping" | "wali_kelas" | "pengurus_hafalan" | "pengurus_capaian_materi" | "pengurus_kelas"
): Promise<PrivilegeFormState> {
  let session;
  try {
    session = await requireRole(["admin"]);
  } catch {
    return { errors: { general: ["Unauthorized"] } };
  }

  try {
    // Check if privilege already exists
    const [existing] = await db
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

    if (existing) {
      return { errors: { general: ["Privilege sudah diberikan"] } };
    }

    await db.insert(dosenPrivileges).values({
      userId,
      classId,
      privilegeType,
      assignedBy: session.user.id,
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
    await db
      .delete(dosenPrivileges)
      .where(
        and(
          eq(dosenPrivileges.userId, userId),
          eq(dosenPrivileges.classId, classId),
          eq(dosenPrivileges.privilegeType, privilegeType as typeof dosenPrivileges.privilegeType.enumValues[number])
        )
      );

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
      return { errors: { general: ["Mahasiswa tidak terdaftar di kelas ini"] } };
    }

    // Check if there's already a ketua umum
    const [existingKetuaUmum] = await db
      .select()
      .from(mahasiswaPrivileges)
      .where(
        and(
          eq(mahasiswaPrivileges.classId, classId),
          eq(mahasiswaPrivileges.privilegeType, "ketua_umum")
        )
      )
      .limit(1);

    if (existingKetuaUmum) {
      // Remove existing ketua umum
      await db
        .delete(mahasiswaPrivileges)
        .where(eq(mahasiswaPrivileges.id, existingKetuaUmum.id));
    }

    // Assign new ketua umum
    await db.insert(mahasiswaPrivileges).values({
      enrollmentId: enrollment.id,
      classId,
      privilegeType: "ketua_umum",
      assignedBy: session.user.id,
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

  const [ketuaUmum] = await db
    .select({
      privilegeId: mahasiswaPrivileges.id,
      enrollmentId: mahasiswaPrivileges.enrollmentId,
      userId: classEnrollments.userId,
      userName: users.name,
      userEmail: users.email,
    })
    .from(mahasiswaPrivileges)
    .innerJoin(
      classEnrollments,
      eq(mahasiswaPrivileges.enrollmentId, classEnrollments.id)
    )
    .innerJoin(users, eq(classEnrollments.userId, users.id))
    .where(
      and(
        eq(mahasiswaPrivileges.classId, classId),
        eq(mahasiswaPrivileges.privilegeType, "ketua_umum")
      )
    )
    .limit(1);

  return ketuaUmum || null;
}

// Get all classes with their ketua umum
export async function getClassesWithKetuaUmum() {
  await requireRole(["admin"]);

  const classList = await db.select().from(classes).where(eq(classes.isActive, true));

  const ketuaUmumList = await db
    .select({
      classId: mahasiswaPrivileges.classId,
      userId: classEnrollments.userId,
      userName: users.name,
    })
    .from(mahasiswaPrivileges)
    .innerJoin(
      classEnrollments,
      eq(mahasiswaPrivileges.enrollmentId, classEnrollments.id)
    )
    .innerJoin(users, eq(classEnrollments.userId, users.id))
    .where(eq(mahasiswaPrivileges.privilegeType, "ketua_umum"));

  return classList.map((cls) => ({
    ...cls,
    ketuaUmum: ketuaUmumList.find((ku) => ku.classId === cls.id) || null,
  }));
}
