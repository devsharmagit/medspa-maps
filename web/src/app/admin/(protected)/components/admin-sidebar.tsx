"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/businesses", label: "Businesses", icon: Globe },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 bg-white border-r border-slate-200 flex flex-col sticky top-0 h-screen overflow-y-auto">
      {/* Wordmark */}
      <div className="flex items-center gap-2.5 px-5 h-14 border-b border-slate-200">
        <div className="w-7 h-7 rounded-md bg-slate-900 flex items-center justify-center text-white font-bold text-sm shrink-0">
          M
        </div>
        <span className="text-sm font-semibold text-slate-800 tracking-tight">MedSpa Admin</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 p-3 flex-1">
        <p className="px-2.5 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          Menu
        </p>
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-slate-50 text-slate-900"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>

      <Separator />
      <div className="px-5 py-3">
        <span className="text-xs text-slate-400">v1.0</span>
      </div>
    </aside>
  );
}
