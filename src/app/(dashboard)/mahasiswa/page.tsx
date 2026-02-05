import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
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
  KETUA_UMUM: "Ketua Umum",
  KETUA_KELOMPOK: "Ketua Kelompok",
  KAMTIB: "Kamtib",
  KETUA_FAN_ILMU: "Ketua Fan Ilmu",
  SEKRETARIS: "Sekretaris",
  BENDAHARA: "Bendahara",
};

async function getMahasiswaData(userId: string) {
  // Get active enrollment
  const enrollment = await prisma.classEnrollment.findFirst({
    where: {
      userId,
      status: "ACTIVE",
    },
    include: {
      class: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
  });

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
  const privileges = await prisma.mahasiswaPrivilege.findMany({
    where: { enrollmentId: enrollment.id },
    select: { privilegeType: true },
  });

  // Get hafalan stats
  const hafalanStats = await prisma.hafalanRecord.groupBy({
    by: ["status"],
    where: { enrollmentId: enrollment.id },
    _count: { id: true },
  });

  type HafalanStat = { status: string; _count: { id: number } };
  const completedHafalan =
    hafalanStats.find((h: HafalanStat) => h.status === "COMPLETED")?._count.id || 0;
  const pendingHafalan =
    hafalanStats.find((h: HafalanStat) => h.status === "PENDING")?._count.id || 0;

  // Get achievement stats
  const achievementStats = await prisma.materialAchievement.groupBy({
    by: ["status"],
    where: { enrollmentId: enrollment.id },
    _count: { id: true },
  });

  type AchievementStat = { status: string; _count: { id: number } };
  const completedAchievements =
    achievementStats.find((a: AchievementStat) => a.status === "COMPLETED")?._count.id || 0;
  const totalAchievements = achievementStats.reduce(
    (sum: number, a: AchievementStat) => sum + (a._count.id || 0),
    0
  );

  // Get attendance stats
  const attendanceStats = await prisma.attendanceRecord.groupBy({
    by: ["status"],
    where: { enrollmentId: enrollment.id },
    _count: { id: true },
  });

  type AttendanceStat = { status: string; _count: { id: number } };
  const presentAttendance =
    attendanceStats.find((a: AttendanceStat) => a.status === "PRESENT")?._count.id || 0;
  const totalAttendance = attendanceStats.reduce(
    (sum: number, a: AttendanceStat) => sum + (a._count.id || 0),
    0
  );

  // Get recent announcements
  const recentAnnouncements = await prisma.announcement.findMany({
    where: { classId: enrollment.classId },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  type PrivilegeItem = { privilegeType: string };

  return {
    enrollment: {
      id: enrollment.id,
      classId: enrollment.classId,
      className: enrollment.class.name,
      classCode: enrollment.class.code,
    },
    privileges: privileges.map((p: PrivilegeItem) => p.privilegeType),
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
                  {data.privileges.map((p: string) => (
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
                    {data.recentAnnouncements.map((announcement: { id: string; title: string; content: string; createdAt: Date }) => (
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
