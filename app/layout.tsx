import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import {
  productFullName,
  productPresentation,
  productThemeVariables,
} from "@/lib/product/presentation";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const socialPreview = productPresentation.assets.socialPreviewPath
  ? [{
      url: productPresentation.assets.socialPreviewPath,
      width: productPresentation.assets.socialPreviewWidth,
      height: productPresentation.assets.socialPreviewHeight,
      alt: productFullName,
    }]
  : undefined;

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      "http://localhost:3000",
  ),
  title: {
    default: productFullName,
    template: `%s | ${productPresentation.identity.workingName}`,
  },
  description: productPresentation.metadata.description,
  openGraph: {
    title: productFullName,
    description: productPresentation.metadata.socialDescription,
    type: "website",
    images: socialPreview,
  },
  twitter: {
    card: "summary_large_image",
    title: productFullName,
    description: productPresentation.metadata.socialDescription,
    images: productPresentation.assets.socialPreviewPath
      ? [productPresentation.assets.socialPreviewPath]
      : undefined,
  },
  icons: { icon: productPresentation.assets.faviconPath },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" style={productThemeVariables}>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
