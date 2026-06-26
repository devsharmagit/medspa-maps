import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { queryOne } from "@/lib/db";
import { ProviderForm } from "@/app/admin/(protected)/providers/provider-form";

export const dynamic = "force-dynamic";

interface Clinic {
  id: string;
  name: string;
}

export default async function NewProviderPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
  }
) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/admin/login");

  const { id } = await props.params;
  const { backUrl } = await props.searchParams;

  const clinic = await queryOne<Clinic>("SELECT id, name FROM clinics WHERE id = $1", [id]);
  if (!clinic) redirect("/admin/clinics");

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto pb-12">
      <div className="text-xs text-slate-400">
        Adding provider to: <span className="font-medium text-slate-600">{clinic.name}</span>
      </div>
      <ProviderForm
        clinicId={id}
        backUrl={typeof backUrl === "string" ? backUrl : undefined}
      />
    </div>
  );
}
