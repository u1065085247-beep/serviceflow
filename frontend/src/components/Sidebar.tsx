"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Ticket,
  PlusCircle,
  Users,
  Building2,
  Gauge,
  Settings,
  Trophy,
  Database,
  ShieldCheck,
  Clock,
  UserCog,
  ClipboardList,
} from "lucide-react";
import clsx from "clsx";

const sections = [
  {
    title: "Gestión de Incidencias",
    items: [
      { href: "/dashboard", label: "Dashboard de Incidencias", icon: Gauge },
      { href: "/tickets", label: "Gestión de Tickets", icon: Ticket },
      { href: "/my-tickets", label: "Mis Tickets", icon: ClipboardList },
      { href: "/tickets/create", label: "Crear Ticket", icon: PlusCircle },
    ],
  },
  {
    title: "Administración",
    items: [
      { href: "/users", label: "Usuarios", icon: Users },
      { href: "/admins", label: "Administradores", icon: UserCog },
      { href: "/companies", label: "Empresas", icon: Building2 },
      { href: "/time", label: "Tiempo por Empresa", icon: Clock },
    ],
  },
  {
    title: "Gamificación",
    items: [
      { href: "/achievements", label: "Sistema de Logros", icon: Trophy },
      { href: "/leaderboard", label: "Tabla de Clasificación", icon: BarChart3 },
    ],
  },
  {
    title: "Sistema",
    items: [
      { href: "/system/logs", label: "Logs del Sistema", icon: Database },
      { href: "/system/config", label: "Configuración del Sistema", icon: Settings },
      { href: "/system/license", label: "Licencia", icon: ShieldCheck },
    ],
  },
] as const;

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:block w-64 bg-[#183763] text-white min-h-screen">
      <div className="px-4 h-14 flex items-center font-semibold">ServiceFlow</div>
      <div className="px-2 py-2 space-y-6">
        {sections.map((section) => (
          <div key={section.title}>
            <div className="px-2 text-xs uppercase tracking-wide text-slate-300/80 mb-2">
              {section.title}
            </div>
            <nav className="space-y-1">
              {section.items.map((item) => {
                const active = pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      "flex items-center gap-2 px-3 py-2 rounded-md",
                      active ? "bg-white/10" : "hover:bg-white/5"
                    )}
                  >
                    <Icon size={16} />
                    <span className="text-sm">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
      </div>
    </aside>
  );
}
