import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  classEnrollments,
  classes,
  mahasiswaPrivileges,
  hafalanRecords,
  materialAchievements,
  attendanceRecords,
  announcements,
} from "@/lib/db/schema";
import { eq, and, count, desc } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building,
  BookMarked,
  CheckSquare,
  ClipboardList,
  Megaphone,
} from "lucide-react";
import Link from "next/link";

const privilegeLabels: Record<string, string> = {
  ketua_umum: "Ketua Umum",
  ketua_kelompok: "Ketua Kelompok",
  kamtib: "Kamtib",
  ketua_fan_ilmu: "Ketua Fan Ilmu",
  sekretaris: "Sekretaris",
  bendahara: "Bendahara",
};

async function getMahasiswaData(userId: string) {
  // Get active enrollment
  const [enrollment] = await db
    .select({
      id: classEnrollments.id,
      classId: classEnrollments.classId,
      className: classes.name,
      classCode: classes.code,
    })
    .from(classEnrollments)
    .innerJoin(classes, eq(classEnrollments.classId, classes.id))
    .where(
      and(
        eq(classEnrollments.userId, userId),
        eq(classEnrollments.status, "active")
      )
    )
    .limit(1);

  if (!enrollment) {
    return {
      enrollment: null,
      privileges: [],
      hafalanStats: { completed: 0, pending: 0 },
      achievementStats: { completed: 0, total: 0 },
      attendanceStats: { present: 0, total: 0 },
      recentAnnouncements: [],
    };
  }

  // Get privileges
  const privileges = await db
    .select({ privilegeType: mahasiswaPrivileges.privilegeType })
    .from(mahasiswaPrivileges)
    .where(eq(mahasiswaPrivileges.enrollmentId, enrollment.id));

  // Get hafalan stats
  const hafalanStats = await db
    .select({
      status: hafalanRecords.status,
      count: count(),
    })
    .from(hafalanRecords)
    .where(eq(hafalanRecords.enrollmentId, enrollment.id))
    .groupBy(hafalanRecords.status);

  const completedHafalan =
    hafalanStats.find((h) => h.status === "completed")?.count || 0;
  const pendingHafalan =
    hafalanStats.find((h) => h.status === "pending")?.count || 0;

  // Get achievement stats
  const achievementStats = await db
    .select({
      status: materialAchievements.status,
      count: count(),
    })
    .from(materialAchievements)
    .where(eq(materialAchievements.enrollmentId, enrollment.id))
    .groupBy(materialAchievements.status);

  const completedAchievements =
    achievementStats.find((a) => a.status === "completed")?.count || 0;
  const totalAchievements = achievementStats.reduce(
    (sum, a) => sum + (a.count || 0),
    0
  );

  // Get attendance stats
  const attendanceStats = await db
    .select({
      status: attendanceRecords.status,
      count: count(),
    })
    .from(attendanceRecords)
    .where(eq(attendanceRecords.enrollmentId, enrollment.id))
    .groupBy(attendanceRecords.status);

  const presentAttendance =
    attendanceStats.find((a) => a.status === "present")?.count || 0;
  const totalAttendance = attendanceStats.reduce(
    (sum, a) => sum + (a.count || 0),
    0
  );

  // Get recent announcements
  const recentAnnouncements = await db
    .select()
    .from(announcements)
    .where(eq(announcements.classId, enrollment.classId))
    .orderBy(desc(announcements.createdAt))
    .limit(3);

  return {
    enrollment,
    privileges: privileges.map((p) => p.privilegeType),
    hafalanStats: { completed: completedHafalan, pending: pendingHafalan },
    achievementStats: { completed: completedAchievements, total: totalAchievements },
    attendanceStats: { present: presentAttendance, total: totalAttendance },
    recentAnnouncements,
  };
}

export default async function MahasiswaDashboardPage() {
  let session;
  try {
    session = await requireRole(["admin", "dosen", "mahasiswa"]);
  } catch {
    redirect("/login");
  }

  const data = await getMahasiswaData(session.user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard Mahasiswa</h1>
        <p className="text-muted-foreground">
          Selamat datang, {session.user.name}
        </p>
      </div>

      {!data.enrollment ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">
              Anda belum terdaftar di kelas manapun. Hubungi admin untuk
              pendaftaran.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Class Info */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  {data.enrollment.className}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {data.enrollment.classCode}
                </p>
              </div>
              {data.privileges.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {data.privileges.map((p) => (
                    <Badge key={p} variant="default">
                      {privilegeLabels[p] || p}
                    </Badge>
                  ))}
                </div>
              )}
            </CardHeader>
          </Card>

          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Hafalan</CardTitle>
                <BookMarked className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.hafalanStats.completed}
                </div>
                <p className="text-xs text-muted-foreground">
                  {data.hafalanStats.pending} pending
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Capaian Materi</CardTitle>
                <CheckSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.achievementStats.completed}/{data.achievementStats.total}
                </div>
                <p className="text-xs text-muted-foreground">Materi selesai</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Kehadiran</CardTitle>
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.attendanceStats.total > 0
                    ? Math.round(
                        (data.attendanceStats.present /
                          data.attendanceStats.total) *
                          100
                      )
                    : 0}
                  %
                </div>
                <p className="text-xs text-muted-foreground">
                  {data.attendanceStats.present}/{data.attendanceStats.total} hadir
                </p>
              </CardContent>
            </Card>

            <Link href="/mahasiswa/announcements">
              <Card className="cursor-pointer hover:bg-muted/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pengumuman</CardTitle>
                  <Megaphone className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {data.recentAnnouncements.length}
                  </div>
                  <p className="text-xs text-muted-foreground">Pengumuman terbaru</p>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Quick Links */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Aksi Cepat</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                <Link
                  href="/mahasiswa/hafalan"
                  className="flex items-center gap-2 rounded-lg border p-3 hover:bg-muted"
                >
                  <BookMarked className="h-5 w-5" />
                  <span>Lihat Progress Hafalan</span>
                </Link>
                <Link
                  href="/mahasiswa/achievements"
                  className="flex items-center gap-2 rounded-lg border p-3 hover:bg-muted"
                >
                  <CheckSquare className="h-5 w-5" />
                  <span>Lihat Capaian Materi</span>
                </Link>
                <Link
                  href="/mahasiswa/attendance"
                  className="flex items-center gap-2 rounded-lg border p-3 hover:bg-muted"
                >
                  <ClipboardList className="h-5 w-5" />
                  <span>Riwayat Kehadiran</span>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pengumuman Terbaru</CardTitle>
              </CardHeader>
              <CardContent>
                {data.recentAnnouncements.length === 0 ? (
                  <p className="text-muted-foreground">Belum ada pengumuman.</p>
                ) : (
                  <div className="space-y-3">
                    {data.recentAnnouncements.map((announcement) => (
                      <div
                        key={announcement.id}
                        className="rounded-lg border p-3"
                      >
                        <h4 className="font-medium">{announcement.title}</h4>
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                          {announcement.content}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {new Date(announcement.createdAt).toLocaleDateString(
                            "id-ID"
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
