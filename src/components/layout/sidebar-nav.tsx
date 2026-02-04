"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  Calendar,
  Settings,
  ClipboardList,
  UserCog,
  Building,
  FolderKanban,
  BookMarked,
  CheckSquare,
  BarChart3,
  Bell,
  Megaphone,
} from "lucide-react";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: NavItem[];
}

const adminNav: NavItem[] = [
  {
    title: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "Tahun Akademik",
    href: "/admin/academic-years",
    icon: Calendar,
  },
  {
    title: "Semester",
    href: "/admin/semesters",
    icon: FolderKanban,
  },
  {
    title: "Kelas",
    href: "/admin/classes",
    icon: Building,
  },
  {
    title: "Pengguna",
    href: "/admin/users",
    icon: Users,
  },
  {
    title: "Privilege",
    href: "/admin/privileges",
    icon: UserCog,
  },
  {
    title: "Laporan",
    href: "/admin/reports",
    icon: BarChart3,
  },
  {
    title: "Pengaturan",
    href: "/admin/settings",
    icon: Settings,
  },
];

const dosenNav: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dosen",
    icon: LayoutDashboard,
  },
  {
    title: "Kelas Saya",
    href: "/dosen/classes",
    icon: Building,
  },
  {
    title: "Hafalan",
    href: "/dosen/hafalan",
    icon: BookMarked,
  },
  {
    title: "Capaian Materi",
    href: "/dosen/materials",
    icon: CheckSquare,
  },
  {
    title: "Kehadiran",
    href: "/dosen/attendance",
    icon: ClipboardList,
  },
  {
    title: "Evaluasi",
    href: "/dosen/evaluations",
    icon: BarChart3,
  },
  {
    title: "Pengaturan",
    href: "/dosen/settings",
    icon: Settings,
  },
];

const mahasiswaNav: NavItem[] = [
  {
    title: "Dashboard",
    href: "/mahasiswa",
    icon: LayoutDashboard,
  },
  {
    title: "Kelas Saya",
    href: "/mahasiswa/class",
    icon: Building,
  },
  {
    title: "Hafalan Saya",
    href: "/mahasiswa/hafalan",
    icon: BookMarked,
  },
  {
    title: "Capaian Materi",
    href: "/mahasiswa/achievements",
    icon: CheckSquare,
  },
  {
    title: "Kehadiran",
    href: "/mahasiswa/attendance",
    icon: ClipboardList,
  },
  {
    title: "Pengumuman",
    href: "/mahasiswa/announcements",
    icon: Megaphone,
  },
  {
    title: "Pengaturan",
    href: "/mahasiswa/settings",
    icon: Settings,
  },
];

// Additional nav for Ketua Umum
const ketuaUmumNav: NavItem[] = [
  {
    title: "Kelola Kelas",
    href: "/mahasiswa/manage",
    icon: UserCog,
  },
  {
    title: "Kelola Kelompok",
    href: "/mahasiswa/groups",
    icon: Users,
  },
  {
    title: "Privilege",
    href: "/mahasiswa/privileges",
    icon: GraduationCap,
  },
];

interface SidebarNavProps {
  userType: "admin" | "dosen" | "mahasiswa";
  isKetuaUmum?: boolean;
}

export function SidebarNav({ userType, isKetuaUmum = false }: SidebarNavProps) {
  const pathname = usePathname();

  const getNavItems = () => {
    switch (userType) {
      case "admin":
        return adminNav;
      case "dosen":
        return dosenNav;
      case "mahasiswa":
        return isKetuaUmum
          ? [...mahasiswaNav.slice(0, 2), ...ketuaUmumNav, ...mahasiswaNav.slice(2)]
          : mahasiswaNav;
      default:
        return [];
    }
  };

  const navItems = getNavItems();

  return (
    <nav className="space-y-1">
      {navItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}
