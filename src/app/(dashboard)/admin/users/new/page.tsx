"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createUser, type UserFormState } from "@/actions/admin/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

const initialState: UserFormState = {};

export default function NewUserPage() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createUser, initialState);

  useEffect(() => {
    if (state.success) {
      toast.success(state.message);
      router.push("/admin/users");
    }
  }, [state.success, state.message, router]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/users">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Tambah Pengguna</h1>
          <p className="text-muted-foreground">
            Buat akun pengguna baru
          </p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Informasi Pengguna</CardTitle>
          <CardDescription>
            Isi data pengguna baru yang akan ditambahkan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            {state.errors?.general && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {state.errors.general.join(", ")}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Nama Lengkap</Label>
              <Input
                id="name"
                name="name"
                placeholder="Nama lengkap"
                required
                disabled={isPending}
              />
              {state.errors?.name && (
                <p className="text-sm text-destructive">
                  {state.errors.name.join(", ")}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="nama@email.com"
                required
                disabled={isPending}
              />
              {state.errors?.email && (
                <p className="text-sm text-destructive">
                  {state.errors.email.join(", ")}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="userType">Tipe Pengguna</Label>
              <Select name="userType" required disabled={isPending}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih tipe pengguna" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mahasiswa">Mahasiswa</SelectItem>
                  <SelectItem value="dosen">Dosen</SelectItem>
                  <SelectItem value="admin">Admin Kurikulum</SelectItem>
                </SelectContent>
              </Select>
              {state.errors?.userType && (
                <p className="text-sm text-destructive">
                  {state.errors.userType.join(", ")}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">No. Telepon (Opsional)</Label>
              <Input
                id="phone"
                name="phone"
                placeholder="08123456789"
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                disabled={isPending}
              />
              {state.errors?.password && (
                <p className="text-sm text-destructive">
                  {state.errors.password.join(", ")}
                </p>
              )}
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  "Simpan"
                )}
              </Button>
              <Link href="/admin/users">
                <Button type="button" variant="outline" disabled={isPending}>
                  Batal
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
