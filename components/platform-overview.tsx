import { BarChart3, Search, ShieldCheck, Wrench } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { SpendingIntelligenceDashboard } from "@/components/spending-intelligence-dashboard";
import Link from "@/components/site-link";

export function PlatformOverview() {
  return (
    <AppShell>
      <div className="pf-page visibility-dashboard-page">
        <SpendingIntelligenceDashboard />

        <nav className="brief-actions" aria-label="Continue from spending intelligence">
          <Link className="button" href="/stores">
            <Search aria-hidden="true" /> Find a store
          </Link>
          <Link className="button" href="/pm">
            <Wrench aria-hidden="true" /> Preventive maintenance &amp; lifecycle
          </Link>
          <Link className="button" href="/accountability">
            <ShieldCheck aria-hidden="true" /> Vendor accountability
          </Link>
          <Link className="button" href="/reports">
            <BarChart3 aria-hidden="true" /> Reports &amp; records
          </Link>
        </nav>
      </div>
    </AppShell>
  );
}
