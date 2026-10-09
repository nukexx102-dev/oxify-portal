import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import Alive from "@/components/Alive";
import ParticleField from "@/components/ParticleField";
import "./globals.css";

// Must match THEME_KEY in components/ThemeToggle.tsx (that file is a client
// module, so its exports can't be read here in a server component).
const THEME_KEY = "oxify-theme";

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
    // suppressHydrationWarning: the startup script sets data-theme and
    // "ox-anim" on <html> before React hydrates. Dark is the default.
    <html lang="en" data-theme="dark" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col font-sans">
        {/* Before the page starts: apply the saved theme (so a light-theme visitor
            never sees a dark flash), and turn the motion effects on unless the
            visitor prefers reduced motion. __oxLite thins the particles on
            low-power devices. If the effects script (Alive) hasn't started within
            5s, motion is switched off so no section stays hidden.
            next/script keeps it out of React's rendering. */}
        <Script id="ox-startup" strategy="beforeInteractive">
          {`(function(){var d=document.documentElement;try{if(localStorage.getItem("${THEME_KEY}")==="light")d.dataset.theme="light"}catch(e){}try{if(!matchMedia("(prefers-reduced-motion: reduce)").matches){d.classList.add("ox-anim");var n=navigator;window.__oxLite=matchMedia("(hover: none)").matches||(n.hardwareConcurrency||8)<=4||(n.deviceMemory||8)<=4||!!(n.connection&&n.connection.saveData);setTimeout(function(){if(!window.__oxAlive)d.classList.remove("ox-anim")},5000)}}catch(e){}})()`}
        </Script>
        <ParticleField />
        <Alive />
        {children}
      </body>
    </html>
  );
}
