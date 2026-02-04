"use server";

import { db } from "@/lib/db";
import {
  hafalanRecords,
  classEnrollments,
  users,
  fanIlmu,
} from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { hasDosenPrivilege } from "@/lib/auth/permissions";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type HafalanFormState = {
  errors?: Record<string, string[]>;
  success?: boolean;
  message?: string;
};

// Validation schema
const createHafalanSchema = z.object({
  enrollmentId: z.string().uuid(),
  fanIlmuId: z.string().uuid().optional(),
  surahOrContent: z.string().min(1, "Konten hafalan harus diisi"),
  ayatStart: z.number().int().positive().optional(),
  ayatEnd: z.number().int().positive().optional(),
});

const evaluateHafalanSchema = z.object({
  hafalanId: z.string().uuid(),
  status: z.enum(["completed", "need_revision"]),
  score: z.number().min(0).max(100),
  notes: z.string().optional(),
});

// Verify dosen has pengurus_hafalan privilege
async function verifyHafalanPrivilege(classId: string) {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const hasPrivilege = await hasDosenPrivilege(
    session.user.id,
    classId,
    "pengurus_hafalan"
  );

  if (!hasPrivilege && session.user.userType !== "admin") {
    throw new Error("Forbidden - Only Pengurus Hafalan can perform this action");
  }

  return session;
}

// Get hafalan records for a class
export async function getClassHafalanRecords(classId: string) {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const records = await db
    .select({
      id: hafalanRecords.id,
      surahOrContent: hafalanRecords.surahOrContent,
      ayatStart: hafalanRecords.ayatStart,
      ayatEnd: hafalanRecords.ayatEnd,
      status: hafalanRecords.status,
      score: hafalanRecords.score,
      notes: hafalanRecords.notes,
      createdAt: hafalanRecords.createdAt,
      evaluatedAt: hafalanRecords.evaluatedAt,
      studentName: users.name,
      studentEmail: users.email,
      fanIlmuName: fanIlmu.name,
      enrollmentId: classEnrollments.id,
    })
    .from(hafalanRecords)
    .innerJoin(
      classEnrollments,
      eq(hafalanRecords.enrollmentId, classEnrollments.id)
    )
    .innerJoin(users, eq(classEnrollments.userId, users.id))
    .leftJoin(fanIlmu, eq(hafalanRecords.fanIlmuId, fanIlmu.id))
    .where(eq(classEnrollments.classId, classId))
    .orderBy(desc(hafalanRecords.createdAt));

  return records;
}

// Get pending hafalan for a class
export async function getPendingHafalan(classId: string) {
  await verifyHafalanPrivilege(classId);

  return db
    .select({
      id: hafalanRecords.id,
      surahOrContent: hafalanRecords.surahOrContent,
      ayatStart: hafalanRecords.ayatStart,
      ayatEnd: hafalanRecords.ayatEnd,
      createdAt: hafalanRecords.createdAt,
      studentName: users.name,
      fanIlmuName: fanIlmu.name,
    })
    .from(hafalanRecords)
    .innerJoin(
      classEnrollments,
      eq(hafalanRecords.enrollmentId, classEnrollments.id)
    )
    .innerJoin(users, eq(classEnrollments.userId, users.id))
    .leftJoin(fanIlmu, eq(hafalanRecords.fanIlmuId, fanIlmu.id))
    .where(
      and(
        eq(classEnrollments.classId, classId),
        eq(hafalanRecords.status, "pending")
      )
    )
    .orderBy(hafalanRecords.createdAt);
}

// Create hafalan record
export async function createHafalanRecord(
  classId: string,
  data: z.infer<typeof createHafalanSchema>
): Promise<HafalanFormState> {
  let session;
  try {
    session = await verifyHafalanPrivilege(classId);
  } catch (error) {
    return { errors: { general: [(error as Error).message] } };
  }

  const validatedFields = createHafalanSchema.safeParse(data);
  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  try {
    await db.insert(hafalanRecords).values({
      enrollmentId: validatedFields.data.enrollmentId,
      fanIlmuId: validatedFields.data.fanIlmuId,
      surahOrContent: validatedFields.data.surahOrContent,
      ayatStart: validatedFields.data.ayatStart,
      ayatEnd: validatedFields.data.ayatEnd,
      status: "pending",
    });

    revalidatePath(`/dosen/classes/${classId}/hafalan`);
    return { success: true, message: "Hafalan berhasil ditambahkan" };
  } catch (error) {
    console.error("Create hafalan error:", error);
    return { errors: { general: ["Gagal menambahkan hafalan"] } };
  }
}

// Evaluate hafalan
export async function evaluateHafalan(
  classId: string,
  data: z.infer<typeof evaluateHafalanSchema>
): Promise<HafalanFormState> {
  let session;
  try {
    session = await verifyHafalanPrivilege(classId);
  } catch (error) {
    return { errors: { general: [(error as Error).message] } };
  }

  const validatedFields = evaluateHafalanSchema.safeParse(data);
  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  try {
    await db
      .update(hafalanRecords)
      .set({
        status: validatedFields.data.status,
        score: validatedFields.data.score.toString(),
        notes: validatedFields.data.notes,
        evaluatedBy: session.user.id,
        evaluatedAt: new Date(),
      })
      .where(eq(hafalanRecords.id, validatedFields.data.hafalanId));

    revalidatePath(`/dosen/classes/${classId}/hafalan`);
    return { success: true, message: "Hafalan berhasil dievaluasi" };
  } catch (error) {
    console.error("Evaluate hafalan error:", error);
    return { errors: { general: ["Gagal mengevaluasi hafalan"] } };
  }
}

// Get student hafalan history
export async function getStudentHafalanHistory(enrollmentId: string) {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  return db
    .select({
      id: hafalanRecords.id,
      surahOrContent: hafalanRecords.surahOrContent,
      ayatStart: hafalanRecords.ayatStart,
      ayatEnd: hafalanRecords.ayatEnd,
      status: hafalanRecords.status,
      score: hafalanRecords.score,
      notes: hafalanRecords.notes,
      createdAt: hafalanRecords.createdAt,
      evaluatedAt: hafalanRecords.evaluatedAt,
      fanIlmuName: fanIlmu.name,
    })
    .from(hafalanRecords)
    .leftJoin(fanIlmu, eq(hafalanRecords.fanIlmuId, fanIlmu.id))
    .where(eq(hafalanRecords.enrollmentId, enrollmentId))
    .orderBy(desc(hafalanRecords.createdAt));
}

// Get fan ilmu options for a class
export async function getClassFanIlmu(classId: string) {
  return db.select().from(fanIlmu).where(eq(fanIlmu.classId, classId));
}
