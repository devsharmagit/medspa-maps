"use client";

import { useParams } from "next/navigation";
import { ConcernForm } from "../../concern-form";

export default function EditConcernPage() {
  const params = useParams<{ id: string }>();
  return <ConcernForm concernId={params.id} />;
}
