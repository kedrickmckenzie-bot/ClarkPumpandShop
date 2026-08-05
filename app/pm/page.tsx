import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { PreventiveLifecycleDashboard } from "@/components/preventive-lifecycle-dashboard";

export const metadata: Metadata = { title: "Preventive Maintenance & Lifecycle" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const value = (key: string) => typeof query[key] === "string" ? query[key] as string : "";
  return (
    <AppShell>
      <div className="pf-page visibility-dashboard-page">
        <PreventiveLifecycleDashboard
          initialCategoryId={value("category")}
          initialStoreId={value("store")}
        />
      </div>
    </AppShell>
  );
}
