import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Inter matches oxify.com's own body/heading font.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Oxify — Order Tracking",
  description: "Track your Oxify hyperbaric chamber order — live status, delivery dates, and documents.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
