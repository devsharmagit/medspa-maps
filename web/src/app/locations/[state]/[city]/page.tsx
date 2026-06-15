export default async function LocationPage({
  params,
}: {
  params: Promise<{ state: string; city: string }>;
}) {
  const { state, city } = await params;

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-16 text-zinc-950">
      <div className="w-full max-w-2xl rounded-3xl border border-zinc-200 bg-white p-10 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
          Location Route
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          {city}, {state}
        </h1>
        <p className="mt-3 text-base text-zinc-600">
          Reserved route for location landing pages at
          {" "}
          <code>/locations/[state]/[city]</code>.
        </p>
      </div>
    </main>
  );
}
