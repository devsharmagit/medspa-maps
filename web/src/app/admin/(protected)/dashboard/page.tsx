import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import BusinessesTable from "../components/businesses-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Globe, TrendingDown } from "lucide-react";

interface Business {
  id: string;
  name: string;
  website_url: string | null;
  is_active: boolean;
  created_at: string;
}

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/admin/login");

  const businesses = await query<Business>(
    "SELECT id, name, website_url, is_active, created_at FROM businesses ORDER BY created_at DESC"
  );

  const total = businesses.length;
  const enabled = businesses.filter((b) => b.is_active).length;
  const disabled = total - enabled;

  const stats = [
    { label: "Total Businesses", value: total, icon: Building2, color: "text-slate-600", bg: "bg-slate-100" },
    { label: "Active", value: enabled, icon: Globe, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Disabled", value: disabled, icon: TrendingDown, color: "text-amber-600", bg: "bg-amber-50" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Dashboard</h2>
        <p className="text-sm text-slate-500">Overview of your MedSpa Map listings.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="shadow-sm border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-slate-500">{label}</CardTitle>
              <div className={`w-8 h-8 rounded-md ${bg} ${color} flex items-center justify-center shrink-0`}>
                <Icon size={16} />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-slate-900">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Businesses table */}
      <BusinessesTable initialBusinesses={businesses} />
    </div>
  );
}
