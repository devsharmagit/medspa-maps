import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import Link from "next/link";
import pool from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import {
  Store,
  Sparkles,
  HeartPulse,
  Star,
  Inbox,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";

export const dynamic = "force-dynamic";

interface StatCard {
  label: string;
  value: string;
  href: string;
  icon: LucideIcon;
  tint: string;
}

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/admin/login");

  const { rows } = await pool.query<{
    clinics: string;
    services: string;
    concerns: string;
    reviews: string;
    unmatched: string;
  }>(`
    SELECT
      (SELECT count(*) FROM clinics)    AS clinics,
      (SELECT count(*) FROM services)   AS services,
      (SELECT count(*) FROM concerns)   AS concerns,
      (SELECT count(*) FROM reviews)    AS reviews,
      (SELECT count(DISTINCT raw_name) FROM clinic_services
        WHERE match_status = 'unmatched' OR service_id IS NULL) AS unmatched
  `);

  const c = rows[0];

  const stats: StatCard[] = [
    { label: "Clinics", value: c.clinics, href: "/admin/clinics", icon: Store, tint: "from-rose-500/15 to-pink-500/15 text-rose-600" },
    { label: "Services", value: c.services, href: "/admin/services", icon: Sparkles, tint: "from-fuchsia-500/15 to-purple-500/15 text-fuchsia-600" },
    { label: "Concerns", value: c.concerns, href: "/admin/concerns", icon: HeartPulse, tint: "from-violet-500/15 to-purple-500/15 text-violet-600" },
    { label: "Reviews", value: c.reviews, href: "/admin/reviews", icon: Star, tint: "from-amber-500/15 to-yellow-500/15 text-amber-600" },
    { label: "Unmatched queue", value: c.unmatched, href: "/admin/unmatched", icon: Inbox, tint: "from-pink-500/15 to-rose-500/15 text-pink-600" },
  ];

  return (
    <div className="flex flex-col gap-7 max-w-6xl">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 tracking-tight">
          Dashboard
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Overview of your MedSpa Map catalog.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map(({ label, value, href, icon: Icon, tint }) => (
          <Link key={label} href={href} className="group block">
            <Card className="border-pink-100/80 ring-pink-100/60 transition-all hover:ring-purple-200 hover:shadow-[0_8px_24px_rgba(195,65,215,0.10)]">
              <CardContent className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-slate-500">
                    {label}
                  </span>
                  <span className="text-3xl font-bold text-slate-900 tabular-nums">
                    {value}
                  </span>
                </div>
                <div
                  className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tint} flex items-center justify-center shrink-0`}
                >
                  <Icon size={18} />
                </div>
              </CardContent>
              <div className="px-4 -mt-1 flex items-center gap-1 text-xs font-medium text-slate-400 group-hover:text-purple-600 transition-colors">
                View
                <ArrowUpRight size={13} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
