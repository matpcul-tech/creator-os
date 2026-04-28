import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CreatorAI — Your AI-Powered Creator Empire",
  description: "The all-in-one AI platform that learns your voice, creates content for every platform, spots trends, and grows your audience.",
  keywords: "AI content creator, content creation platform, social media AI, creator tools",
  openGraph: {
    title: "CreatorAI — Your AI-Powered Creator Empire",
    description: "The all-in-one AI platform that learns your voice and builds your creator empire.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
