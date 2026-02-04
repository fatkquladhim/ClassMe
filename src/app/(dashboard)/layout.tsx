import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { Header } from "@/components/layout/header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Toaster } from "@/components/ui/sonner";
import { hasMahasiswaPrivilege } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { classEnrollments } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

async function checkKetuaUmum(userId: string): Promise<boolean> {
  // Get active enrollment
  const [enrollment] = await db
    .select()
    .from(classEnrollments)
    .where(
      and(
        eq(classEnrollments.userId, userId),
        eq(classEnrollments.status, "active")
      )
    )
    .limit(1);

  if (!enrollment) return false;

  return hasMahasiswaPrivilege(userId, enrollment.classId, "ketua_umum");
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const isKetuaUmum =
    session.user.userType === "mahasiswa"
      ? await checkKetuaUmum(session.user.id)
      : false;

  return (
    <div className="flex min-h-screen flex-col">
      <Header user={session.user} isKetuaUmum={isKetuaUmum} />
      <div className="flex flex-1">
        <AppSidebar userType={session.user.userType} isKetuaUmum={isKetuaUmum} />
        <main className="flex-1 overflow-y-auto bg-muted/30 p-4 md:p-6">
          {children}
        </main>
      </div>
      <Toaster />
    </div>
  );
}
