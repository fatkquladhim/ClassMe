import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { getClasses } from "@/actions/admin/classes";
import prisma from "@/lib/prisma";
import { ClassesTable } from "./classes-table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

export default async function ClassesPage() {
  try {
    await requireRole(["admin"]);
  } catch {
    redirect("/login");
  }

  const activeSemester = await prisma.semester.findFirst({
    where: { isActive: true },
  });

  const classes = activeSemester
    ? await getClasses(activeSemester.id)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Kelas</h1>
          <p className="text-muted-foreground">
            Kelola kelas untuk semester{" "}
            {activeSemester
              ? `${activeSemester.type === "GANJIL" ? "Ganjil" : "Genap"}`
              : "(Belum ada semester aktif)"}
          </p>
        </div>
        {activeSemester && (
          <Link href="/admin/classes/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Tambah Kelas
            </Button>
          </Link>
        )}
      </div>

      {!activeSemester ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-muted-foreground mb-4">
            Belum ada semester aktif. Silakan buat semester terlebih dahulu.
          </p>
          <Link href="/admin/semesters/new">
            <Button>Buat Semester</Button>
          </Link>
        </div>
      ) : (
        <ClassesTable classes={classes} />
      )}
    </div>
  );
}
