import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://clarks-operations-demo.kedrick-mckenzie.chatgpt.site"),
  title: { default: "Maintenance Intelligence", template: "%s · Maintenance Intelligence" },
  description: "Maintenance spending visibility, preventive maintenance, lifecycle planning, and vendor accountability.",
  openGraph: {
    title: "Maintenance Intelligence",
    description: "Follow maintenance spending from the portfolio to the work, equipment, and evidence behind it.",
    type: "website",
    images: [
      {
        url: "/og-maintenance-intelligence.png",
        width: 1734,
        height: 907,
        alt: "Maintenance Intelligence dashboard showing spending, lifecycle, and equipment drill-downs.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Maintenance Intelligence",
    description: "Follow maintenance spending from the portfolio to the work, equipment, and evidence behind it.",
    images: ["/og-maintenance-intelligence.png"],
  },
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
