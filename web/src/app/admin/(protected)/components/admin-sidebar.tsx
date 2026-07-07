"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PlusCircle,
  Store,
  Building2,
  Sparkles,
  HeartPulse,
  Star,
  Inbox,
  Users,
  DatabaseZap,
  Globe,
  Mail,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/leads", label: "Leads", icon: Mail },
  { href: "/admin/clinics/new", label: "Add Clinic", icon: PlusCircle },
  { href: "/admin/g99", label: "G99 Import", icon: DatabaseZap },
  { href: "/admin/g99-websites", label: "G99 Websites", icon: Globe },
  { href: "/admin/clinics", label: "Clinics", icon: Store },
  { href: "/admin/providers", label: "Providers", icon: Users },
  { href: "/admin/businesses", label: "Businesses", icon: Building2 },
  { href: "/admin/services", label: "Treatments", icon: Sparkles },
  { href: "/admin/treatment-changes", label: "Treatment Changes", icon: History },
  { href: "/admin/concerns", label: "Concerns", icon: HeartPulse },
  { href: "/admin/reviews", label: "Reviews", icon: Star },
  { href: "/admin/unmatched", label: "Unmatched", icon: Inbox },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 bg-white border-r border-pink-100/80 flex flex-col sticky top-0 h-screen overflow-y-auto">
      {/* Wordmark */}
      <Link href="/admin/dashboard" className="flex items-center gap-2.5 px-5 h-16 border-b border-pink-100/80 transition-opacity hover:opacity-80">
        <div className="w-8 h-8 rounded-lg bg-[linear-gradient(135deg,#DE7F4C_0%,#C341D7_100%)] flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-[0_4px_12px_rgba(195,65,215,0.25)]">
          M
        </div>
        <span className="text-sm font-semibold text-slate-800 tracking-tight">
          MedSpa Admin
        </span>
      </Link>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 p-3 flex-1">
        <p className="px-2.5 pt-2 pb-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          Menu
        </p>
        {navItems.map(({ href, label, icon: Icon }) => {
          // Exact match for /clinics/new; prefix match otherwise (but never let
          // /clinics light up while on /clinics/new).
          const isActive =
            href === "/admin/clinics"
              ? pathname === href ||
                (pathname.startsWith("/admin/clinics") &&
                  pathname !== "/admin/clinics/new")
              : pathname === href ||
                (href !== "/admin/dashboard" && pathname.startsWith(`${href}/`));

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-[linear-gradient(90deg,rgba(222,127,76,0.12)_0%,rgba(195,65,215,0.12)_100%)] text-purple-700"
                  : "text-slate-600 hover:bg-pink-50/70 hover:text-purple-700"
              )}
            >
              <Icon
                size={17}
                className={cn(
                  "shrink-0 transition-colors",
                  isActive
                    ? "text-purple-600"
                    : "text-slate-400 group-hover:text-purple-500"
                )}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-pink-100/80">
        <span className="text-xs text-slate-400">v1.0</span>
      </div>
    </aside>
  );
}
