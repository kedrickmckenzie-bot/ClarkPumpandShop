import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "R&M Control", template: "%s · R&M Control" },
  description: "Maintenance intelligence, financial control, and provider accountability for multi-site operators.",
  openGraph: {
    title: "R&M Control",
    description: "See the money, the work, and who owns what next.",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1733,
        height: 909,
        alt: "R&M Control — see the money, the work, and who owns what next.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "R&M Control",
    description: "See the money, the work, and who owns what next.",
    images: ["/og.png"],
  },
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
