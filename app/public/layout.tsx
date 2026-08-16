import type { Metadata } from "next";
import { productPresentation } from "@/lib/product/presentation";

export const metadata: Metadata = {
  title: `Secure service action · ${productPresentation.identity.workingName}`,
  description: "Account-free store and vendor service workflow.",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default function PublicWorkflowLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
