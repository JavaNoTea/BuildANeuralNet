import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import MobileWarning from "@/components/MobileWarning";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Build A Neural Net",
  description: "Visual neural network builder with PyTorch code generation. Design neural networks with drag & drop, then export clean PyTorch code.",
  keywords: ["neural network", "pytorch", "deep learning", "machine learning", "visual builder", "code generation"],
  authors: [{ name: "Christian King" }],
  creator: "Christian King",
  publisher: "BuildANeural.net",
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '16x16 32x32', type: 'image/x-icon' }
    ],
    apple: [
      { url: '/icon.svg', type: 'image/svg+xml' }
    ],
  },
  openGraph: {
    title: "Build A Neural Net",
    description: "Visual neural network builder with PyTorch code generation",
    url: "https://www.buildaneural.net",
    siteName: "Build A Neural Net",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Build A Neural Net",
    description: "Visual neural network builder with PyTorch code generation",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <MobileWarning />
        {children}
      </body>
    </html>
  );
}
