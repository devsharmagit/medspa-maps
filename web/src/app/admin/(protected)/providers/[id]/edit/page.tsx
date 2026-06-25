import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { queryOne } from "@/lib/db";
import { ProviderForm } from "@/app/admin/(protected)/providers/provider-form";

export const dynamic = "force-dynamic";

interface ProviderRow {
  id: string;
  clinic_id: string;
}

export default async function EditProviderPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
  }
) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/admin/login");

  const { id } = await props.params;
  const { backUrl } = await props.searchParams;

  const provider = await queryOne<ProviderRow>(
    "SELECT id, clinic_id FROM providers WHERE id = $1",
    [id]
  );
  if (!provider) redirect("/admin/clinics");

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto pb-12">
      <ProviderForm
        clinicId={provider.clinic_id}
        providerId={id}
        backUrl={typeof backUrl === "string" ? backUrl : undefined}
      />
    </div>
  );
}
