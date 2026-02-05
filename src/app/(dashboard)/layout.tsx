import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { Header } from "@/components/layout/header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Toaster } from "@/components/ui/sonner";
import { hasMahasiswaPrivilege } from "@/lib/auth/permissions";
import prisma from "@/lib/prisma";

async function checkKetuaUmum(userId: string): Promise<boolean> {
  // Get active enrollment
  const enrollment = await prisma.classEnrollment.findFirst({
    where: {
      userId,
      status: "ACTIVE",
    },
  });

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
