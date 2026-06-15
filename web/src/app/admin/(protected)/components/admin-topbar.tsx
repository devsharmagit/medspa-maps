"use client";

import { signOut } from "next-auth/react";
import { LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface AdminTopbarProps {
  email: string;
}

export default function AdminTopbar({ email }: AdminTopbarProps) {
  return (
    <header className="flex items-center justify-between px-7 h-14 bg-white border-b border-slate-200 sticky top-0 z-10">
      <h1 className="text-sm font-semibold text-slate-800">Admin Panel</h1>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-900 shrink-0">
            <User size={13} />
          </div>
          <span className="text-sm text-slate-600">{email}</span>
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
