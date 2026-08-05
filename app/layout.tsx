import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Clark's Operations",
    template: "%s · Clark's Operations",
  },
  description: "Maintenance operations and asset intelligence for convenience-store operators.",
  openGraph: {
    title: "Clark's Operations",
    description: "Internal work-order control and asset intelligence for convenience-store operators.",
    type: "website",
    images: [{ url: "/og-card.png", width: 1733, height: 909, alt: "Modern convenience store connected to maintenance, refrigeration and verification signals" }],
  },
  twitter: { card: "summary_large_image", images: ["/og-card.png"] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
