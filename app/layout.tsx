import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      "https://clarks-operations-demo.kedrick-mckenzie.chatgpt.site",
  ),
  title: { default: "TraceOps Convenience Suite", template: "%s | TraceOps" },
  description:
    "A purpose-built convenience retail suite for vendor accountability, maintenance work, spend visibility, equipment, and preventive maintenance.",
  openGraph: {
    title: "TraceOps Convenience Suite",
    description: "Every service visit accounted for. Every maintenance dollar explained.",
    type: "website",
    images: [
      {
        url: "/traceops-og.png",
        width: 1731,
        height: 909,
        alt: "TraceOps Convenience Suite",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TraceOps Convenience Suite",
    description: "Every service visit accounted for. Every maintenance dollar explained.",
    images: ["/traceops-og.png"],
  },
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
