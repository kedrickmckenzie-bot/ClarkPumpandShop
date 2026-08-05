import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Clark's Maintenance", template: "%s · Clark's Maintenance" },
  description: "Maintenance work, store costs, equipment, teams, and vendors in one place.",
  openGraph: {
    title: "Clark's Maintenance",
    description: "See the work, the cost, and who acts next.",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1733,
        height: 909,
        alt: "Clark's Maintenance — see the work, the cost, and who acts next.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Clark's Maintenance",
    description: "See the work, the cost, and who acts next.",
    images: ["/og.png"],
  },
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
