import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Secure service action · TraceOps",
  description: "Account-free store and vendor service workflow.",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default function PublicWorkflowLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
