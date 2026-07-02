import { Suspense } from "react";
import { LeadsTable } from "./leads-table";

export const metadata = {
  title: "Medspa Leads | Admin",
};

export default function LeadsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Medspa Leads</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage business inquiries from the "List your medspa" form
          </p>
        </div>
      </div>

      <Suspense fallback={<LoadingSkeleton />}>
        <LeadsTable />
      </Suspense>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-20 w-full animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  );
}
