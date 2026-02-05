import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building, GraduationCap, BookOpen } from "lucide-react";

async function getStats() {
  // Get total users by type
  const userStats = await prisma.user.groupBy({
    by: ["userType"],
    where: { isActive: true },
    _count: { id: true },
  });

  // Get active semester
  const activeSemester = await prisma.semester.findFirst({
    where: { isActive: true },
  });

  // Get total classes in active semester
  let totalClasses = 0;
  let totalEnrollments = 0;

  if (activeSemester) {
    totalClasses = await prisma.class.count({
      where: {
        semesterId: activeSemester.id,
        isActive: true,
      },
    });

    totalEnrollments = await prisma.classEnrollment.count({
      where: {
        semesterId: activeSemester.id,
        status: "ACTIVE",
      },
    });
  }

  type UserStat = { userType: string; _count: { id: number } };
  const totalAdmin = userStats.find((u: UserStat) => u.userType === "ADMIN")?._count.id || 0;
  const totalDosen = userStats.find((u: UserStat) => u.userType === "DOSEN")?._count.id || 0;
  const totalMahasiswa = userStats.find((u: UserStat) => u.userType === "MAHASISWA")?._count.id || 0;

  return {
    totalAdmin,
    totalDosen,
    totalMahasiswa,
    totalClasses,
    totalEnrollments,
    activeSemester,
  };
}

export default async function AdminDashboardPage() {
  try {
    await requireRole(["admin"]);
  } catch {
    redirect("/login");
  }

  const stats = await getStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard Admin</h1>
        <p className="text-muted-foreground">
          Selamat datang di panel admin MAMAL
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Dosen</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDosen}</div>
            <p className="text-xs text-muted-foreground">Dosen aktif</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Mahasiswa</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMahasiswa}</div>
            <p className="text-xs text-muted-foreground">Mahasiswa aktif</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Kelas</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalClasses}</div>
            <p className="text-xs text-muted-foreground">
              Semester{" "}
              {stats.activeSemester?.type === "GANJIL" ? "Ganjil" : "Genap"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Enrollment</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEnrollments}</div>
            <p className="text-xs text-muted-foreground">
              Mahasiswa terdaftar di kelas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Aksi Cepat</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <a
              href="/admin/classes/new"
              className="flex items-center gap-2 rounded-lg border p-3 hover:bg-muted"
            >
              <Building className="h-5 w-5" />
              <span>Buat Kelas Baru</span>
            </a>
            <a
              href="/admin/users/new"
              className="flex items-center gap-2 rounded-lg border p-3 hover:bg-muted"
            >
              <Users className="h-5 w-5" />
              <span>Tambah Pengguna</span>
            </a>
            <a
              href="/admin/privileges"
              className="flex items-center gap-2 rounded-lg border p-3 hover:bg-muted"
            >
              <GraduationCap className="h-5 w-5" />
              <span>Kelola Privilege</span>
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Semester Aktif</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.activeSemester ? (
              <div className="space-y-2">
                <p className="font-medium">
                  Semester {stats.activeSemester.type === "GANJIL" ? "Ganjil" : "Genap"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {new Date(stats.activeSemester.startDate).toLocaleDateString("id-ID")} -{" "}
                  {new Date(stats.activeSemester.endDate).toLocaleDateString("id-ID")}
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground">
                Belum ada semester aktif. Silakan buat semester baru.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
