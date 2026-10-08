"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Sparkles, ArrowRight, FileText, Mic, Film, Check, Loader2, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

/* Waitlist form, used in the hero and again at the bottom of the page. */
function WaitlistForm({ source, id }: { source: string; id?: string }) {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState(""); // honeypot
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setState("error");
      setMessage("Please enter a valid email address.");
      return;
    }
    setState("sending");
    setMessage("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: clean, source, company }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) {
        setState("error");
        setMessage("Too many tries. Please wait a few minutes and try again.");
        return;
      }
      if (!res.ok) {
        setState("error");
        setMessage(data.error || "Something went wrong. Please try again.");
        return;
      }
      setState("done");
      setMessage(data.message || "You're on the list.");
    } catch {
      setState("error");
      setMessage("Couldn't reach the server. Please try again.");
    }
  }

  if (state === "done") {
    return (
      <div
        id={id}
        role="status"
        className="flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 max-w-xl"
      >
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
          <Check size={16} className="text-emerald-400" />
        </div>
        <div>
          <p className="font-semibold text-white">Thanks for joining!</p>
          <p className="text-sm text-dark-300">{message}</p>
        </div>
      </div>
    );
  }

  return (
    <form id={id} onSubmit={submit} className="max-w-xl" noValidate>
      <div className="flex flex-col sm:flex-row gap-3">
        <label htmlFor={`${source}-email`} className="sr-only">Email address</label>
        <input
          id={`${source}-email`}
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          maxLength={254}
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 min-w-0 rounded-xl border border-dark-700 bg-dark-900/70 px-4 py-4 text-white placeholder:text-dark-500 focus:border-brand-500 focus:outline-none"
        />
        {/* Honeypot. Hidden from people and screen readers. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            Company
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              name="company"
            />
          </label>
        </div>
        <Button type="submit" size="lg" disabled={state === "sending"} className="shrink-0">
          {state === "sending" ? (
            <><Loader2 size={18} className="mr-2 animate-spin" /> Joining...</>
          ) : (
            <>Join the waitlist <ArrowRight size={18} className="ml-2" /></>
          )}
        </Button>
      </div>
      {state === "error" && (
        <p role="alert" className="mt-3 text-sm text-red-400">{message}</p>
      )}
      <p className="mt-3 text-sm text-dark-500">
        We&apos;ll only email you about early access. No spam.
      </p>
    </form>
  );
}

function Navbar() {
  return (
    <nav className="absolute top-0 left-0 right-0 z-50 py-5">
      <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-blue-500 flex items-center justify-center">
            <Sparkles size={18} className="text-white" />
          </div>
          <span className="text-xl font-bold text-white">Creator<span className="gradient-text">AI</span></span>
        </Link>
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm text-dark-400 hover:text-white transition-colors"
        >
          <Lock size={14} /> Owner login
        </Link>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="relative pt-32 pb-20 sm:pt-40 overflow-hidden">
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(124,58,237,0.15), transparent 70%)" }} />
      <div className="relative max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-14 items-center">
        <div>
          <p className="inline-flex items-center rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-300 mb-6">
            In private testing. Early access by waitlist.
          </p>
          <h1 className="text-4xl sm:text-6xl font-black leading-[1.05] tracking-tight text-white mb-6">
            Turn a script into a <span className="gradient-text">faceless short video</span>, with voice.
          </h1>
          <p className="text-lg text-dark-400 leading-relaxed mb-8 max-w-xl">
            Paste your script. CreatorAI splits it into scenes, adds a natural voiceover, matches visuals and on-screen text, and gives you a vertical video ready for TikTok, Reels, or Shorts. No camera, no editing timeline.
          </p>
          <WaitlistForm source="hero" id="waitlist" />
        </div>

        <div className="relative hidden lg:block" aria-hidden="true">
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-brand-500/20 to-blue-500/20 blur-2xl" />
          <div className="relative mx-auto w-64 aspect-[9/16] rounded-[2rem] glass border border-dark-700/60 p-4 flex flex-col justify-between">
            <div className="rounded-xl bg-dark-800/60 p-3">
              <p className="text-[10px] uppercase tracking-widest text-dark-500 mb-1">Scene 1</p>
              <p className="text-sm font-bold text-white leading-snug">Your hook, big and bold on screen.</p>
            </div>
            <div className="flex items-end gap-1 h-10 px-1">
              {[30, 60, 45, 80, 50, 70, 40, 65, 35, 55, 75, 45].map((h, i) => (
                <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-brand-600/70 to-blue-500/50" style={{ height: `${h}%` }} />
              ))}
            </div>
            <div className="rounded-xl bg-dark-800/60 p-3 flex items-center gap-2">
              <Mic size={14} className="text-brand-400" />
              <p className="text-xs text-dark-300">Voiceover synced to each scene</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { icon: FileText, title: "Paste a script", desc: "Write it yourself or start from a title. Each line becomes a scene card you can edit." },
    { icon: Mic, title: "Pick a voice", desc: "Choose a narrator voice. The voiceover is generated and timed to your scenes." },
    { icon: Film, title: "Export the video", desc: "Get a vertical video with visuals and captions, ready to post where you like." },
  ];
  return (
    <section className="py-20 border-t border-dark-800/50">
      <div className="max-w-6xl mx-auto px-6">
        <h2 className="text-3xl sm:text-4xl font-black text-white mb-10 text-center">How it works</h2>
        <div className="grid md:grid-cols-3 gap-5">
          {steps.map((s, i) => (
            <div key={s.title} className="glass rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-brand-500/15 flex items-center justify-center">
                  <s.icon size={20} className="text-brand-400" />
                </div>
                <span className="text-sm font-semibold text-dark-500">Step {i + 1}</span>
              </div>
              <h3 className="text-lg font-bold text-white mb-1">{s.title}</h3>
              <p className="text-sm text-dark-400 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const faqs = [
    { q: "Can I use it today?", a: "Not yet. CreatorAI is in private testing with a single owner account. Join the waitlist and we'll email you when early access opens." },
    { q: "How much will it cost?", a: "Pricing isn't set yet. Nothing is charged today, and there is no checkout. We'll share pricing before anyone is asked to pay." },
    { q: "Do I need to show my face or record my voice?", a: "No. The videos are faceless, and the voiceover is generated for you." },
    { q: "Where can I post the videos?", a: "Anywhere that takes vertical video, like TikTok, Instagram Reels, and YouTube Shorts. You download the file and post it yourself." },
  ];
  return (
    <section className="py-20 border-t border-dark-800/50">
      <div className="max-w-3xl mx-auto px-6">
        <h2 className="text-3xl font-black text-white mb-8 text-center">Questions</h2>
        <div className="space-y-3">
          {faqs.map((f) => (
            <div key={f.q} className="glass rounded-xl p-5">
              <p className="font-semibold text-white mb-1">{f.q}</p>
              <p className="text-sm text-dark-400 leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="py-20 border-t border-dark-800/50">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">Want early access?</h2>
        <p className="text-dark-400 mb-8">Leave your email and we&apos;ll let you know when it&apos;s ready.</p>
        <div className="flex justify-center text-left">
          <WaitlistForm source="footer" />
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="py-10 border-t border-dark-800/50">
      <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-dark-500">
        <span className="font-semibold text-dark-300">CreatorAI</span>
        <Link href="/login" className="hover:text-white transition-colors">Owner login</Link>
        <span>&copy; 2026 CreatorAI</span>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <main>
      <Navbar />
      <Hero />
      <HowItWorks />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}
