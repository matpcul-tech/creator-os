import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CreatorAI - Turn a script into a faceless short video",
  description: "Paste a script and get a faceless vertical video with a natural voiceover. Join the waitlist for early access.",
  keywords: "AI content creator, content creation platform, social media AI, creator tools",
  openGraph: {
    title: "CreatorAI - Turn a script into a faceless short video",
    description: "Paste a script and get a faceless vertical video with a natural voiceover.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Figtree:wght@500;600&family=Instrument+Serif&display=swap"
        />
        {children}
      </body>
    </html>
  );
}
