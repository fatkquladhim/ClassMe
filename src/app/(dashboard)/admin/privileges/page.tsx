import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { getDosenWithPrivileges, getClassesWithKetuaUmum } from "@/actions/admin/privileges";
import { PrivilegesManager } from "./privileges-manager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function PrivilegesPage() {
  try {
    await requireRole(["admin"]);
  } catch {
    redirect("/login");
  }

  const [dosenWithPrivileges, classesWithKetuaUmum] = await Promise.all([
    getDosenWithPrivileges(),
    getClassesWithKetuaUmum(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Kelola Privilege</h1>
        <p className="text-muted-foreground">
          Atur privilege dosen dan ketua umum kelas
        </p>
      </div>

      <Tabs defaultValue="dosen" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dosen">Privilege Dosen</TabsTrigger>
          <TabsTrigger value="ketua-umum">Ketua Umum</TabsTrigger>
        </TabsList>

        <TabsContent value="dosen">
          <PrivilegesManager
            type="dosen"
            dosenList={dosenWithPrivileges}
            classesList={classesWithKetuaUmum}
          />
        </TabsContent>

        <TabsContent value="ketua-umum">
          <PrivilegesManager
            type="ketua-umum"
            dosenList={dosenWithPrivileges}
            classesList={classesWithKetuaUmum}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
