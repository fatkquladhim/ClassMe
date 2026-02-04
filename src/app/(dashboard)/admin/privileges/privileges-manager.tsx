"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, UserCog } from "lucide-react";
import {
  assignDosenPrivilege,
  removeDosenPrivilege,
  assignKetuaUmum,
} from "@/actions/admin/privileges";
import { toast } from "sonner";

interface Privilege {
  classId: string;
  className: string;
  privilegeType: string;
}

interface DosenWithPrivileges {
  id: string;
  name: string;
  email: string;
  privileges: Privilege[];
}

interface ClassWithKetuaUmum {
  id: string;
  name: string;
  code: string;
  ketuaUmum: {
    userId: string;
    userName: string;
  } | null;
}

interface PrivilegesManagerProps {
  type: "dosen" | "ketua-umum";
  dosenList: DosenWithPrivileges[];
  classesList: ClassWithKetuaUmum[];
}

const privilegeLabels: Record<string, string> = {
  dosen_pendamping: "Dosen Pendamping",
  wali_kelas: "Wali Kelas",
  pengurus_hafalan: "Pengurus Hafalan",
  pengurus_capaian_materi: "Pengurus Capaian Materi",
  pengurus_kelas: "Pengurus Kelas",
};

export function PrivilegesManager({
  type,
  dosenList,
  classesList,
}: PrivilegesManagerProps) {
  const [selectedDosen, setSelectedDosen] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedPrivilege, setSelectedPrivilege] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleAssignDosenPrivilege = async () => {
    if (!selectedDosen || !selectedClass || !selectedPrivilege) {
      toast.error("Pilih semua field yang diperlukan");
      return;
    }

    setIsLoading(true);
    const result = await assignDosenPrivilege(
      selectedDosen,
      selectedClass,
      selectedPrivilege as "dosen_pendamping" | "wali_kelas" | "pengurus_hafalan" | "pengurus_capaian_materi" | "pengurus_kelas"
    );
    setIsLoading(false);

    if (result.success) {
      toast.success(result.message);
      setIsDialogOpen(false);
      setSelectedDosen("");
      setSelectedClass("");
      setSelectedPrivilege("");
    } else {
      toast.error(result.errors?.general?.[0] || "Gagal memberikan privilege");
    }
  };

  const handleRemoveDosenPrivilege = async (
    userId: string,
    classId: string,
    privilegeType: string
  ) => {
    if (!confirm("Apakah Anda yakin ingin menghapus privilege ini?")) {
      return;
    }

    const result = await removeDosenPrivilege(userId, classId, privilegeType);
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.errors?.general?.[0] || "Gagal menghapus privilege");
    }
  };

  if (type === "dosen") {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Privilege Dosen</CardTitle>
            <CardDescription>
              Kelola privilege dosen untuk setiap kelas
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Tambah Privilege
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tambah Privilege Dosen</DialogTitle>
                <DialogDescription>
                  Pilih dosen, kelas, dan tipe privilege
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Dosen</Label>
                  <Select value={selectedDosen} onValueChange={setSelectedDosen}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih dosen" />
                    </SelectTrigger>
                    <SelectContent>
                      {dosenList.map((dosen) => (
                        <SelectItem key={dosen.id} value={dosen.id}>
                          {dosen.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Kelas</Label>
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih kelas" />
                    </SelectTrigger>
                    <SelectContent>
                      {classesList.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name} ({cls.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tipe Privilege</Label>
                  <Select
                    value={selectedPrivilege}
                    onValueChange={setSelectedPrivilege}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih privilege" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(privilegeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full"
                  onClick={handleAssignDosenPrivilege}
                  disabled={isLoading}
                >
                  {isLoading ? "Menyimpan..." : "Simpan"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dosen</TableHead>
                <TableHead>Kelas</TableHead>
                <TableHead>Privilege</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dosenList.flatMap((dosen) =>
                dosen.privileges.length === 0 ? [] :
                dosen.privileges.map((priv, idx) => (
                  <TableRow key={`${dosen.id}-${priv.classId}-${priv.privilegeType}`}>
                    {idx === 0 && (
                      <TableCell rowSpan={dosen.privileges.length}>
                        <div>
                          <p className="font-medium">{dosen.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {dosen.email}
                          </p>
                        </div>
                      </TableCell>
                    )}
                    <TableCell>{priv.className}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {privilegeLabels[priv.privilegeType] || priv.privilegeType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          handleRemoveDosenPrivilege(
                            dosen.id,
                            priv.classId,
                            priv.privilegeType
                          )
                        }
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
              {dosenList.every((d) => d.privileges.length === 0) && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-10">
                    <p className="text-muted-foreground">
                      Belum ada privilege yang diberikan
                    </p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  }

  // Ketua Umum view
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ketua Umum Kelas</CardTitle>
        <CardDescription>
          Kelola ketua umum untuk setiap kelas
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kelas</TableHead>
              <TableHead>Kode</TableHead>
              <TableHead>Ketua Umum</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {classesList.map((cls) => (
              <TableRow key={cls.id}>
                <TableCell className="font-medium">{cls.name}</TableCell>
                <TableCell>
                  <code className="rounded bg-muted px-2 py-1 text-sm">
                    {cls.code}
                  </code>
                </TableCell>
                <TableCell>
                  {cls.ketuaUmum ? (
                    <div className="flex items-center gap-2">
                      <UserCog className="h-4 w-4 text-primary" />
                      <span>{cls.ketuaUmum.userName}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Belum ditunjuk</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/admin/classes/${cls.id}/enrollments?assign=ketua-umum`}>
                      {cls.ketuaUmum ? "Ganti" : "Tunjuk"}
                    </a>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {classesList.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-10">
                  <p className="text-muted-foreground">Belum ada kelas</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
