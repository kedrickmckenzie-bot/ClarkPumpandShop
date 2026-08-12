import type { Metadata } from "next";
import { PlatformShell } from "@/components/ops/platform-shell";
import { loadOperatorSession } from "./_data/operator-loader";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Operator workspace", template: "%s | TraceOps" },
  robots: { index: false, follow: false },
};

export default async function OperatorLayout({ children }: { children: React.ReactNode }) {
  const session = await loadOperatorSession();
  return <PlatformShell session={session}>{children}</PlatformShell>;
}
