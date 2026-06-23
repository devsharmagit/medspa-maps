import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import AdminSidebar from "./components/admin-sidebar";
import AdminTopbar from "./components/admin-topbar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Preserve the existing next-auth gate — unauthenticated visitors go to login.
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/admin/login");
  }

  return (
    <div className="flex min-h-screen bg-[linear-gradient(180deg,#fdf6fb_0%,#faf5fc_100%)]">
      <AdminSidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <AdminTopbar email={session.user?.email ?? ""} />
        <main className="flex-1 p-7">{children}</main>
      </div>
    </div>
  );
}
