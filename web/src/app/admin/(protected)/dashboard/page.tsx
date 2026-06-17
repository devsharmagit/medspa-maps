import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Store } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/admin/login");

  const [businessesCount, clinicsCount] = await Promise.all([
    query<{ count: string }>("SELECT COUNT(*) FROM businesses"),
    query<{ count: string }>("SELECT COUNT(*) FROM clinics")
  ]);

  const stats = [
    { label: "Total Businesses", value: businessesCount[0].count, icon: Building2, color: "text-slate-600", bg: "bg-slate-100" },
    { label: "Total Clinics", value: clinicsCount[0].count, icon: Store, color: "text-emerald-600", bg: "bg-emerald-50" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Dashboard</h2>
        <p className="text-sm text-slate-500">Overview of your MedSpa Map entities.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
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
      
      <div className="py-12 flex items-center justify-center text-slate-400 border border-dashed border-slate-200 rounded-lg bg-slate-50">
        <p className="text-sm">Use the left sidebar to navigate to Businesses and Clinics.</p>
      </div>
    </div>
  );
}
