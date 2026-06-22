import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";

const display = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
});
const sans = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

const DESC =
  "Reach every recruiter with a personalized email, follow up automatically, and send your resume the moment they say yes — all from your own inbox.";

export const metadata: Metadata = {
  metadataBase: new URL("https://hiremory.vercel.app"),
  title: "Hiremory — personalized job outreach on autopilot",
  description: DESC,
  openGraph: {
    title: "Hiremory — personalized job outreach on autopilot",
    description: DESC,
    url: "https://hiremory.vercel.app",
    siteName: "Hiremory",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Hiremory — reach every recruiter with a letter, not a blast",
    description: DESC,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${display.variable} ${sans.variable}`}>
      <body>
        <Nav />
        {children}
      </body>
    </html>
  );
}
