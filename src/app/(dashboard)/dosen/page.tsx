import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  dosenPrivileges,
  classes,
  classEnrollments,
  hafalanRecords,
  attendanceRecords,
} from "@/lib/db/schema";
import { eq, count, and, sql } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building,
  BookMarked,
  ClipboardList,
  Users,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

const privilegeLabels: Record<string, string> = {
  dosen_pendamping: "Dosen Pendamping",
  wali_kelas: "Wali Kelas",
  pengurus_hafalan: "Pengurus Hafalan",
  pengurus_capaian_materi: "Pengurus Capaian Materi",
  pengurus_kelas: "Pengurus Kelas",
};

async function getDosenData(userId: string) {
  // Get classes where dosen has privileges
  const privileges = await db
    .select({
      classId: dosenPrivileges.classId,
      className: classes.name,
      classCode: classes.code,
      privilegeType: dosenPrivileges.privilegeType,
    })
    .from(dosenPrivileges)
    .innerJoin(classes, eq(dosenPrivileges.classId, classes.id))
    .where(eq(dosenPrivileges.userId, userId));

  // Group by class
  const classMap = new Map<
    string,
    { id: string; name: string; code: string; privileges: string[] }
  >();

  for (const p of privileges) {
    if (classMap.has(p.classId)) {
      classMap.get(p.classId)!.privileges.push(p.privilegeType);
    } else {
      classMap.set(p.classId, {
        id: p.classId,
        name: p.className,
        code: p.classCode,
        privileges: [p.privilegeType],
      });
    }
  }

  const myClasses = Array.from(classMap.values());

  // Get stats for each class
  const classIds = myClasses.map((c) => c.id);

  let totalStudents = 0;
  let totalHafalan = 0;
  const todayAttendance = 0;

  if (classIds.length > 0) {
    // Total students
    const [studentCount] = await db
      .select({ count: count() })
      .from(classEnrollments)
      .where(
        and(
          sql`${classEnrollments.classId} IN (${sql.join(classIds.map(id => sql`${id}`), sql`, `)})`,
          eq(classEnrollments.status, "active")
        )
      );
    totalStudents = studentCount?.count || 0;

    // Total hafalan (pending)
    const [hafalanCount] = await db
      .select({ count: count() })
      .from(hafalanRecords)
      .innerJoin(
        classEnrollments,
        eq(hafalanRecords.enrollmentId, classEnrollments.id)
      )
      .where(
        and(
          sql`${classEnrollments.classId} IN (${sql.join(classIds.map(id => sql`${id}`), sql`, `)})`,
          eq(hafalanRecords.status, "pending")
        )
      );
    totalHafalan = hafalanCount?.count || 0;
  }

  return {
    myClasses,
    totalStudents,
    totalHafalan,
    todayAttendance,
  };
}

export default async function DosenDashboardPage() {
  let session;
  try {
    session = await requireRole(["admin", "dosen"]);
  } catch {
    redirect("/login");
  }

  const data = await getDosenData(session.user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard Dosen</h1>
        <p className="text-muted-foreground">
          Selamat datang, {session.user.name}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kelas Saya</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.myClasses.length}</div>
            <p className="text-xs text-muted-foreground">Kelas yang diampu</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Mahasiswa</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalStudents}</div>
            <p className="text-xs text-muted-foreground">Di semua kelas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hafalan Pending</CardTitle>
            <BookMarked className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalHafalan}</div>
            <p className="text-xs text-muted-foreground">Perlu dievaluasi</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kehadiran Hari Ini</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.todayAttendance}</div>
            <p className="text-xs text-muted-foreground">Sudah tercatat</p>
          </CardContent>
        </Card>
      </div>

      {/* My Classes */}
      <Card>
        <CardHeader>
          <CardTitle>Kelas Saya</CardTitle>
        </CardHeader>
        <CardContent>
          {data.myClasses.length === 0 ? (
            <p className="text-muted-foreground">
              Anda belum ditugaskan ke kelas manapun.
            </p>
          ) : (
            <div className="space-y-4">
              {data.myClasses.map((cls) => (
                <Link
                  key={cls.id}
                  href={`/dosen/classes/${cls.id}`}
                  className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted"
                >
                  <div>
                    <h3 className="font-medium">{cls.name}</h3>
                    <p className="text-sm text-muted-foreground">{cls.code}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {cls.privileges.map((p) => (
                        <Badge key={p} variant="secondary">
                          {privilegeLabels[p] || p}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
