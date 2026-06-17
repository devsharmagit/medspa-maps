import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import ClinicsTable, { Clinic } from "../components/clinics-table";

export const dynamic = "force-dynamic";

export default async function ClinicsPage(props: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/admin/login");

  const searchParams = await props.searchParams;
  const q = searchParams.q || "";
  const page = parseInt(searchParams.page || "1", 10);
  const limit = 20;
  const offset = (page - 1) * limit;

  let dbQuery = "SELECT * FROM clinics";
  let countQuery = "SELECT COUNT(*) FROM clinics";
  const params: any[] = [];
  const countParams: any[] = [];

  if (q) {
    dbQuery += " WHERE name ILIKE $1 OR city ILIKE $1 OR state ILIKE $1";
    countQuery += " WHERE name ILIKE $1 OR city ILIKE $1 OR state ILIKE $1";
    params.push(`%${q}%`);
    countParams.push(`%${q}%`);
  }

  dbQuery += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const [clinics, totalResult] = await Promise.all([
    query<Clinic>(dbQuery, params),
    query<{ count: string }>(countQuery, countParams)
  ]);

  const total = parseInt(totalResult[0].count, 10);
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Clinics</h2>
        <p className="text-sm text-slate-500">Manage all registered clinics and locations.</p>
      </div>

      <ClinicsTable 
        initialData={clinics} 
        searchQuery={q} 
        currentPage={page} 
        totalPages={totalPages} 
      />
    </div>
  );
}
