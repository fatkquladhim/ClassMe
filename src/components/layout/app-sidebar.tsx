"use client";

import { SidebarNav } from "./sidebar-nav";
import { GraduationCap } from "lucide-react";

interface AppSidebarProps {
  userType: "admin" | "dosen" | "mahasiswa";
  isKetuaUmum?: boolean;
}

export function AppSidebar({ userType, isKetuaUmum = false }: AppSidebarProps) {
  return (
    <aside className="hidden w-64 shrink-0 border-r bg-card md:block">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <GraduationCap className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold">MAMAL</h1>
            <p className="text-[10px] text-muted-foreground">
              Manajemen Kelas Kuliah
            </p>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto p-4">
          <SidebarNav userType={userType} isKetuaUmum={isKetuaUmum} />
        </div>

        {/* Footer */}
        <div className="border-t p-4">
          <p className="text-xs text-muted-foreground text-center">
            &copy; {new Date().getFullYear()} MAMAL
          </p>
        </div>
      </div>
    </aside>
  );
}
