"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface AdminTopbarProps {
  email: string;
}

export default function AdminTopbar({ email }: AdminTopbarProps) {
  const initial = (email || "?").charAt(0).toUpperCase();

  return (
    <header className="flex items-center justify-between px-7 h-16 bg-white/80 backdrop-blur border-b border-pink-100/80 sticky top-0 z-10">
      <h1 className="text-sm font-semibold text-slate-800">Admin Panel</h1>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[linear-gradient(135deg,#DE7F4C_0%,#C341D7_100%)] flex items-center justify-center text-white text-xs font-semibold shrink-0">
            {initial}
          </div>
          <span className="text-sm text-slate-600 hidden sm:inline">{email}</span>
        </div>

        <Separator orientation="vertical" className="h-5" />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut({ callbackUrl: "/admin/login" })}
          className="text-slate-500 hover:text-red-600 hover:bg-red-50 gap-1.5"
        >
          <LogOut size={14} />
          Sign out
        </Button>
      </div>
    </header>
  );
}
