"use server";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { hasDosenPrivilege } from "@/lib/auth/permissions";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// Type helpers
type PrismaHafalanStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "NEED_REVISION";

function toHafalanPrismaEnum(status: string): PrismaHafalanStatus {
  return status.toUpperCase().replace("-", "_") as PrismaHafalanStatus;
}

function fromHafalanPrismaEnum(status: PrismaHafalanStatus): string {
  return status.toLowerCase().replace("_", "-");
}

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

  const records = await prisma.hafalanRecord.findMany({
    where: {
      enrollment: {
        classId,
      },
    },
    include: {
      enrollment: {
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
      fanIlmu: {
        select: {
          name: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return records.map((record: typeof records[number]) => ({
    id: record.id,
    surahOrContent: record.surahOrContent,
    ayatStart: record.ayatStart,
    ayatEnd: record.ayatEnd,
    status: fromHafalanPrismaEnum(record.status as PrismaHafalanStatus),
    score: record.score,
    notes: record.notes,
    createdAt: record.createdAt,
    evaluatedAt: record.evaluatedAt,
    studentName: record.enrollment.user.name,
    studentEmail: record.enrollment.user.email,
    fanIlmuName: record.fanIlmu?.name || null,
    enrollmentId: record.enrollmentId,
  }));
}

// Get pending hafalan for a class
export async function getPendingHafalan(classId: string) {
  await verifyHafalanPrivilege(classId);

  const records = await prisma.hafalanRecord.findMany({
    where: {
      enrollment: {
        classId,
      },
      status: "PENDING",
    },
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
      fanIlmu: {
        select: {
          name: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return records.map((record: typeof records[number]) => ({
    id: record.id,
    surahOrContent: record.surahOrContent,
    ayatStart: record.ayatStart,
    ayatEnd: record.ayatEnd,
    createdAt: record.createdAt,
    studentName: record.enrollment.user.name,
    fanIlmuName: record.fanIlmu?.name || null,
  }));
}

// Create hafalan record
export async function createHafalanRecord(
  classId: string,
  data: z.infer<typeof createHafalanSchema>
): Promise<HafalanFormState> {
  try {
    await verifyHafalanPrivilege(classId);
  } catch (error) {
    return { errors: { general: [(error as Error).message] } };
  }

  const validatedFields = createHafalanSchema.safeParse(data);
  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  try {
    await prisma.hafalanRecord.create({
      data: {
        enrollmentId: validatedFields.data.enrollmentId,
        fanIlmuId: validatedFields.data.fanIlmuId,
        surahOrContent: validatedFields.data.surahOrContent,
        ayatStart: validatedFields.data.ayatStart,
        ayatEnd: validatedFields.data.ayatEnd,
        status: "PENDING",
      },
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
    await prisma.hafalanRecord.update({
      where: { id: validatedFields.data.hafalanId },
      data: {
        status: toHafalanPrismaEnum(validatedFields.data.status),
        score: validatedFields.data.score,
        notes: validatedFields.data.notes,
        evaluatedBy: session.user.id,
        evaluatedAt: new Date(),
      },
    });

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

  const records = await prisma.hafalanRecord.findMany({
    where: { enrollmentId },
    include: {
      fanIlmu: {
        select: {
          name: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return records.map((record: typeof records[number]) => ({
    id: record.id,
    surahOrContent: record.surahOrContent,
    ayatStart: record.ayatStart,
    ayatEnd: record.ayatEnd,
    status: fromHafalanPrismaEnum(record.status as PrismaHafalanStatus),
    score: record.score,
    notes: record.notes,
    createdAt: record.createdAt,
    evaluatedAt: record.evaluatedAt,
    fanIlmuName: record.fanIlmu?.name || null,
  }));
}

// Get fan ilmu options for a class
export async function getClassFanIlmu(classId: string) {
  return prisma.fanIlmu.findMany({
    where: { classId },
  });
}

// Get hafalan progress for a student
export async function getHafalanProgress(enrollmentId: string) {
  const records = await prisma.hafalanRecord.findMany({
    where: { enrollmentId },
    include: {
      fanIlmu: true,
    },
  });

  const progressByFanIlmu: Record<string, {
    name: string;
    total: number;
    completed: number;
    totalScore: number;
    averageScore: number;
  }> = {};

  records.forEach((record: typeof records[number]) => {
    const fanIlmuId = record.fanIlmuId || "general";
    
    if (!progressByFanIlmu[fanIlmuId]) {
      progressByFanIlmu[fanIlmuId] = {
        name: record.fanIlmu?.name || "Umum",
        total: 0,
        completed: 0,
        totalScore: 0,
        averageScore: 0,
      };
    }
    
    const progress = progressByFanIlmu[fanIlmuId];
    progress.total++;
    
    if (record.status === "COMPLETED") {
      progress.completed++;
      progress.totalScore += Number(record.score) || 0;
    }
  });

  // Calculate average scores
  Object.keys(progressByFanIlmu).forEach((fanId) => {
    const progress = progressByFanIlmu[fanId];
    progress.averageScore = progress.completed > 0 
      ? progress.totalScore / progress.completed 
      : 0;
  });

  return progressByFanIlmu;
}
