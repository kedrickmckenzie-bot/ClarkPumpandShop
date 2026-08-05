import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { VendorVisibilityDashboard } from "@/components/vendor-visibility-dashboard";

export const metadata: Metadata = { title: "Vendor Accountability", description: "See accepted work, store visits, outcomes, and optional supporting evidence." };
export default function Page() {
  return (
    <AppShell>
      <div className="pf-page visibility-dashboard-page">
        <VendorVisibilityDashboard />
      </div>
    </AppShell>
  );
}
