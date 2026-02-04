import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

export default async function HomePage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // Redirect based on user type
  switch (session.user.userType) {
    case "admin":
      redirect("/admin");
    case "dosen":
      redirect("/dosen");
    case "mahasiswa":
      redirect("/mahasiswa");
    default:
      redirect("/login");
  }
}
