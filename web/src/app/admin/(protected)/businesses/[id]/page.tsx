import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { query, queryOne } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, Store, ArrowLeft, Pencil } from "lucide-react";
import Link from "next/link";
import type { Business } from "../../components/businesses-table";
import type { Clinic } from "../../components/clinics-table";

export const dynamic = "force-dynamic";

export default async function BusinessDetailPage(props: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/admin/login");

  const { id } = await props.params;

  const business = await queryOne<Business>("SELECT * FROM businesses WHERE id = $1", [id]);
  
  if (!business) {
    return (
      <div className="py-12 flex flex-col items-center justify-center text-slate-500">
        <Building2 size={48} className="opacity-20 mb-4" />
        <p>Business not found.</p>
        <Link href="/admin/businesses">
          <Button variant="outline" className="mt-4">Back to Businesses</Button>
        </Link>
      </div>
    );
  }

  const clinics = await query<Clinic>("SELECT * FROM clinics WHERE business_id = $1 ORDER BY created_at DESC", [id]);

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/businesses">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-900">
              <ArrowLeft size={16} />
            </Button>
          </Link>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              {business.name}
              {!business.is_active && <Badge variant="secondary" className="bg-slate-100 text-slate-500">Disabled</Badge>}
            </h2>
            <p className="text-xs text-slate-500 font-mono mt-0.5">{business.id}</p>
          </div>
        </div>
        
        <Button className="bg-brand-purple hover:bg-brand-magenta text-white gap-2">
          <Pencil size={14} />
          Edit Business
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 shadow-sm border-slate-200">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
            <CardTitle className="text-base font-semibold text-slate-800">Business Details</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 gap-y-6 gap-x-8 text-sm">
              <div>
                <p className="text-slate-500 text-xs mb-1.5 uppercase tracking-wider font-semibold">Tier</p>
                <p className="capitalize font-medium text-slate-800">{business.tier}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-1.5 uppercase tracking-wider font-semibold">Verified</p>
                <Badge variant={business.verified ? "default" : "secondary"} className={business.verified ? "bg-blue-50 text-blue-700 hover:bg-blue-50" : ""}>
                  {business.verified ? "Yes" : "No"}
                </Badge>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-1.5 uppercase tracking-wider font-semibold">Data Source</p>
                <p className="capitalize font-medium text-slate-800">{business.data_source}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-1.5 uppercase tracking-wider font-semibold">Created At</p>
                <p className="font-medium text-slate-800">{new Date(business.created_at).toLocaleString()}</p>
              </div>
              {business.g99_business_id && (
                <div>
                  <p className="text-slate-500 text-xs mb-1.5 uppercase tracking-wider font-semibold">G99 Business ID</p>
                  <p className="font-mono text-slate-800">{business.g99_business_id}</p>
                </div>
              )}
              {business.g99_tenant_id && (
                <div>
                  <p className="text-slate-500 text-xs mb-1.5 uppercase tracking-wider font-semibold">G99 Tenant ID</p>
                  <p className="font-mono text-slate-800">{business.g99_tenant_id}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
            <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Store size={16} className="text-slate-400" />
              Clinics ({clinics.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {clinics.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">No clinics found.</div>
            ) : (
              <div className="flex flex-col divide-y divide-slate-100">
                {clinics.map(clinic => (
                  <Link key={clinic.id} href={`/admin/clinics/${clinic.id}`} className="p-4 hover:bg-slate-50 transition-colors block">
                    <p className="font-medium text-sm text-brand-purple">{clinic.name}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {clinic.city && clinic.state ? `${clinic.city}, ${clinic.state}` : "No location data"}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
