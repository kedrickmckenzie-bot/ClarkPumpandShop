import type { Metadata } from "next";
import { PlatformShell } from "@/components/ops/platform-shell";
import { productPresentation } from "@/lib/product/presentation";
import { loadOperatorSession } from "./_data/operator-loader";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "Operator workspace",
    template: `%s | ${productPresentation.identity.workingName}`,
  },
  robots: { index: false, follow: false },
};

export default async function OperatorLayout({ children }: { children: React.ReactNode }) {
  const session = await loadOperatorSession();
  return <PlatformShell session={session}>{children}</PlatformShell>;
}
