"use client";

import { useParams } from "next/navigation";
import { ServiceForm } from "../../service-form";

export default function EditServicePage() {
  const params = useParams<{ id: string }>();
  return <ServiceForm serviceId={params.id} />;
}
