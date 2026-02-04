import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { getUsers } from "@/actions/admin/users";
import { UsersTable } from "./users-table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

export default async function UsersPage() {
  try {
    await requireRole(["admin"]);
  } catch {
    redirect("/login");
  }

  const users = await getUsers();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pengguna</h1>
          <p className="text-muted-foreground">
            Kelola semua pengguna sistem MAMAL
          </p>
        </div>
        <Link href="/admin/users/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Tambah Pengguna
          </Button>
        </Link>
      </div>

      <UsersTable users={users} />
    </div>
  );
}
