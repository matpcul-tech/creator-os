"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useInView } from "framer-motion";
import {
  Sparkles, ArrowRight, Zap, TrendingUp, Users, Brain,
  Repeat, Shield, Calendar, BarChart3, DollarSign,
  GraduationCap, Wand2, Check, Star, Menu, X,
  ChevronDown, Target, Rocket, Mail,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import Link from "next/link";

/* ─── ANIMATED SECTION ─────────────────────────────────── */
function Anim({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── NAVBAR ───────────────────────────────────────────── */
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  const links = [
    { label: "Features", href: "#features" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "Pricing", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? "py-3 glass" : "py-5"}`}>
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-blue-500 flex items-center justify-center">
            <Sparkles size={18} className="text-white" />
          </div>
          <span className="text-xl font-bold text-white">Creator<span className="gradient-text">AI</span></span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <a key={l.label} href={l.href} className="text-sm text-dark-400 hover:text-white transition-colors">{l.label}</a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Link href="/login"><Button variant="ghost" size="sm">Log In</Button></Link>
          <Link href="/signup"><Button size="sm">Get Early Access</Button></Link>
        </div>

        <button className="md:hidden text-white" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {mobileOpen && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="md:hidden px-6 pt-4 pb-6 glass">
          {links.map((l) => (
            <a key={l.label} href={l.href} onClick={() => setMobileOpen(false)} className="block py-3 text-dark-300 hover:text-white border-b border-dark-800/50">{l.label}</a>
          ))}
          <Link href="/signup" onClick={() => setMobileOpen(false)} className="block mt-4 text-center">
            <Button className="w-full">Get Early Access</Button>
          </Link>
        </motion.div>
      )}
    </nav>
  );
}

/* ─── HERO ─────────────────────────────────────────────── */
function Hero() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      await fetch("/api/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    } catch {}
    setSubmitted(true);
    setLoading(false);
  };

  return (
    <section id="hero" className="relative min-h-screen flex items-center pt-28 pb-20 overflow-hidden">
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(124,58,237,0.15), transparent 70%)" }} />
      <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(rgba(148,163,184,0.06) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

      <div className="relative max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
        <div>
          <Anim>
            <Badge variant="success" className="mb-8">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse mr-2 inline-block" />
              Now in Early Access — Join 2,400+ Creators
            </Badge>
          </Anim>

          <Anim delay={0.1}>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-[1.05] tracking-tight mb-6">
              Your AI-Powered<br />
              <span className="gradient-text">Creator Empire</span><br />
              Starts Here
            </h1>
          </Anim>

          <Anim delay={0.2}>
            <p className="text-lg text-dark-400 leading-relaxed mb-10 max-w-xl">
              One platform that learns your unique voice, creates content for every platform, spots viral trends, and grows your audience — <span className="text-white font-medium">whether you have 0 or 1M followers.</span>
            </p>
          </Anim>

          <Anim delay={0.3}>
            {!submitted ? (
              <form onSubmit={handleSubmit}>
                <div className="flex flex-col sm:flex-row gap-3 mb-3">
                  <input
                    type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" required
                    className="flex-1 px-5 py-4 rounded-xl bg-dark-800/50 border border-dark-700 text-white placeholder:text-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all"
                  />
                  <Button type="submit" size="lg" className="shrink-0">
                    {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><span>Get Early Access</span><ArrowRight size={18} className="ml-2" /></>}
                  </Button>
                </div>
                <p className="text-sm text-dark-500">Free to start · No credit card required · Cancel anytime</p>
              </form>
            ) : (
              <div className="flex items-center gap-3 px-6 py-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0"><Check size={20} className="text-emerald-400" /></div>
                <div><p className="text-white font-semibold">You&apos;re on the list!</p><p className="text-sm text-dark-400">We&apos;ll notify you when it&apos;s your turn.</p></div>
              </div>
            )}
          </Anim>

          <Anim delay={0.4}>
            <div className="flex flex-wrap gap-8 mt-10">
              {[
                { icon: Users, value: "2,400+", label: "Creators Waiting", color: "text-brand-400" },
                { icon: Zap, value: "10x", label: "Faster Content", color: "text-amber-400" },
                { icon: TrendingUp, value: "5+", label: "Platforms", color: "text-emerald-400" },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-3">
                  <s.icon size={20} className={`${s.color} opacity-70`} />
                  <div><p className="text-xl font-bold text-white">{s.value}</p><p className="text-xs text-dark-500">{s.label}</p></div>
                </div>
              ))}
            </div>
          </Anim>
        </div>

        {/* Dashboard Preview */}
        <Anim delay={0.3} className="hidden lg:block">
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-500/20 to-blue-500/20 blur-xl" />
            <div className="relative rounded-2xl overflow-hidden glass">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-dark-700/50">
                <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-red-500/80" /><div className="w-3 h-3 rounded-full bg-yellow-500/80" /><div className="w-3 h-3 rounded-full bg-green-500/80" /></div>
                <div className="flex-1 mx-4"><div className="mx-auto max-w-xs px-3 py-1 rounded-md text-xs text-dark-500 text-center bg-dark-800/50">app.creatorai.com/dashboard</div></div>
              </div>
              <div className="flex gap-1 px-4 py-2 border-b border-dark-800/50 overflow-x-auto">
                {["Dashboard", "Studio", "Calendar", "Analytics", "Brand DNA", "Monetize"].map((t, i) => (
                  <div key={t} className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap ${i === 0 ? "bg-brand-500/15 text-brand-400" : "text-dark-500"}`}>{t}</div>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-3 p-4">
                {[
                  { label: "Followers", val: "24.8K", change: "+12%", color: "text-brand-400" },
                  { label: "Engagement", val: "8.4%", change: "+3.2%", color: "text-emerald-400" },
                  { label: "Content", val: "142", change: "+28", color: "text-blue-400" },
                  { label: "Brand Score", val: "94", change: "/100", color: "text-amber-400" },
                ].map((s) => (
                  <div key={s.label} className="p-3 rounded-xl bg-dark-800/40 border border-dark-700/30">
                    <p className="text-[10px] text-dark-500 mb-1">{s.label}</p>
                    <p className="text-lg font-bold text-white">{s.val}</p>
                    <p className={`text-[10px] font-medium ${s.color}`}>{s.change}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-5 gap-3 px-4 pb-4">
                <div className="col-span-3 p-3 rounded-xl bg-dark-800/40 border border-dark-700/30">
                  <p className="text-[10px] text-dark-500 mb-3">Weekly Growth</p>
                  <div className="flex items-end gap-2 h-20">
                    {[35, 50, 42, 68, 55, 82, 78].map((h, i) => (
                      <motion.div key={i} className="flex-1 rounded-t-md bg-gradient-to-t from-brand-600/60 to-blue-500/40" initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ duration: 0.6, delay: 0.8 + i * 0.08 }} />
                    ))}
                  </div>
                </div>
                <div className="col-span-2 p-3 rounded-xl bg-dark-800/40 border border-dark-700/30">
                  <p className="text-[10px] text-dark-500 mb-2">🔥 Trending</p>
                  {["AI productivity hacks", "Day-in-my-life format", "#BuildInPublic wave"].map((t) => (
                    <div key={t} className="flex items-center justify-between py-1.5 border-b border-dark-800/30 last:border-0">
                      <span className="text-[10px] text-dark-300 truncate pr-2">{t}</span>
                      <span className="text-[9px] text-emerald-400 shrink-0">↑</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Anim>
      </div>
    </section>
  );
}

/* ─── FEATURES ─────────────────────────────────────────── */
function Features() {
  const features = [
    { icon: Brain, title: "Brand DNA Engine", desc: "AI learns your unique voice, tone, and style. Every piece of content sounds authentically YOU — never generic.", tag: "Unique to CreatorAI", gradient: "from-brand-500 to-purple-500" },
    { icon: Wand2, title: "Universal Content Studio", desc: "Create blogs, tweets, reels, carousels, newsletters, and video scripts from one workspace.", gradient: "from-blue-500 to-cyan-500" },
    { icon: Repeat, title: "1-Click Repurposing", desc: "Turn one blog post into 10+ pieces of platform-optimized content instantly.", tag: "Save 10+ hrs/week", gradient: "from-purple-500 to-pink-500" },
    { icon: TrendingUp, title: "Trend Radar", desc: "Real-time scanning of viral trends across all platforms, filtered to YOUR niche.", gradient: "from-emerald-500 to-teal-500" },
    { icon: Shield, title: "Brand Consistency Score", desc: "Every piece gets scored before publishing. Stay on-brand across every platform.", tag: "Nobody else has this", gradient: "from-amber-500 to-orange-500" },
    { icon: Calendar, title: "Smart Content Calendar", desc: "AI fills your calendar with what to post, when to post, and on which platform.", gradient: "from-rose-500 to-red-500" },
    { icon: BarChart3, title: "Cross-Platform Analytics", desc: "All your stats in one dashboard with AI explanations of WHY things work.", gradient: "from-sky-500 to-blue-500" },
    { icon: DollarSign, title: "Monetization Copilot", desc: "AI generates media kits, brand pitches, and pricing suggestions.", gradient: "from-emerald-500 to-green-500" },
    { icon: GraduationCap, title: "Creator Academy", desc: "Personalized lessons that teach content creation skills based on where you are.", gradient: "from-violet-500 to-brand-500" },
  ];

  return (
    <section id="features" className="relative py-28">
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(59,130,246,0.06), transparent)" }} />
      <div className="relative max-w-7xl mx-auto px-6">
        <Anim className="text-center mb-16">
          <p className="text-sm font-semibold tracking-widest uppercase text-brand-400 mb-3">Everything You Need</p>
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">One Platform. Every Tool.</h2>
          <p className="text-lg text-dark-400 max-w-2xl mx-auto">Stop paying for 10 different tools. CreatorAI replaces your entire content stack.</p>
        </Anim>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <Anim key={f.title} delay={i * 0.05}>
              <Card hover className="h-full">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.gradient} flex items-center justify-center mb-4`}>
                  <f.icon size={22} className="text-white" />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-bold text-white">{f.title}</h3>
                  {f.tag && <Badge>{f.tag}</Badge>}
                </div>
                <p className="text-sm text-dark-400 leading-relaxed">{f.desc}</p>
              </Card>
            </Anim>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── TOOLS REPLACED ───────────────────────────────────── */
function ToolsReplaced() {
  const tools = ["Jasper AI", "Copy.ai", "Buffer", "Hootsuite", "Later", "Canva", "Descript", "Opus Clip", "Notion AI", "Metricool", "Taplio", "Repurpose.io"];
  return (
    <section className="py-20">
      <div className="max-w-5xl mx-auto px-6 text-center">
        <Anim>
          <p className="text-sm text-dark-500 mb-6">One platform to replace them all</p>
          <div className="flex flex-wrap justify-center gap-3 mb-6">
            {tools.map((t) => (
              <span key={t} className="px-4 py-2 rounded-full text-sm text-dark-500 line-through glass">{t}</span>
            ))}
          </div>
          <p className="text-sm font-semibold text-emerald-400">Save $200-500/month by switching to CreatorAI</p>
        </Anim>
      </div>
    </section>
  );
}

/* ─── HOW IT WORKS ─────────────────────────────────────── */
function HowItWorks() {
  const steps = [
    { num: "01", title: "Tell Us Who You Are", desc: "Take a 2-minute quiz about your niche, goals, style, and platforms. Paste a few content samples so AI can learn your voice.", icon: Target },
    { num: "02", title: "AI Builds Your Brand DNA", desc: "We generate your unique voice profile, brand guidelines, content strategy, and a full calendar — automatically.", icon: Brain },
    { num: "03", title: "Create Content in Seconds", desc: "Use the studio to generate any content type with your voice applied. Repurpose one piece into 10+ formats.", icon: Wand2 },
    { num: "04", title: "Publish, Analyze, Grow", desc: "Schedule and publish to all platforms. AI analyzes performance and tells you exactly what to do next.", icon: Rocket },
  ];
  return (
    <section id="how-it-works" className="relative py-28">
      <div className="relative max-w-5xl mx-auto px-6">
        <Anim className="text-center mb-16">
          <p className="text-sm font-semibold tracking-widest uppercase text-brand-400 mb-3">Simple Process</p>
          <h2 className="text-4xl sm:text-5xl font-black text-white">From Zero to Creator in 4 Steps</h2>
        </Anim>
        <div className="space-y-5">
          {steps.map((step, i) => (
            <Anim key={step.num} delay={i * 0.1}>
              <div className="flex gap-6 items-start p-6 rounded-2xl glass transition-all hover:translate-x-1">
                <div className="shrink-0 w-14 h-14 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-xl font-black text-brand-400">{step.num}</div>
                <div><h3 className="text-xl font-bold text-white mb-1">{step.title}</h3><p className="text-sm text-dark-400 leading-relaxed">{step.desc}</p></div>
              </div>
            </Anim>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── TESTIMONIALS ─────────────────────────────────────── */
function Testimonials() {
  const testimonials = [
    { name: "Sarah K.", role: "Lifestyle Creator · 52K followers", text: "I went from posting 3x/week to daily across 4 platforms. My engagement tripled in the first month.", avatar: "SK" },
    { name: "Marcus T.", role: "Tech YouTuber · 128K subs", text: "The Brand DNA feature is what sold me. Every script it writes actually sounds like me. My audience can't tell the difference.", avatar: "MT" },
    { name: "Priya L.", role: "Business Coach · 34K followers", text: "I was spending $400/mo on 5 different tools. CreatorAI replaced all of them and the content is better.", avatar: "PL" },
  ];
  return (
    <section className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <Anim className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-black text-white">Loved by Creators</h2>
        </Anim>
        <div className="grid md:grid-cols-3 gap-5">
          {testimonials.map((t, i) => (
            <Anim key={t.name} delay={i * 0.1}>
              <Card className="h-full flex flex-col">
                <div className="flex gap-1 mb-4">{[...Array(5)].map((_, j) => <Star key={j} size={14} className="text-amber-400 fill-amber-400" />)}</div>
                <p className="text-sm text-dark-300 leading-relaxed flex-1 mb-5">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-blue-500 flex items-center justify-center text-xs font-bold text-white">{t.avatar}</div>
                  <div><p className="text-sm font-semibold text-white">{t.name}</p><p className="text-xs text-dark-500">{t.role}</p></div>
                </div>
              </Card>
            </Anim>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── PRICING ──────────────────────────────────────────── */
function Pricing() {
  const plans = [
    { name: "Starter", price: "Free", period: "", desc: "Perfect for getting started", features: ["5 AI content pieces/month", "1 platform", "Basic Brand DNA", "Community access"], cta: "Start Free", featured: false },
    { name: "Creator", price: "$29", period: "/mo", desc: "For serious creators", features: ["Unlimited content", "All platforms", "Full Brand DNA Engine", "1-Click Repurposing", "Smart Calendar", "Cross-platform analytics", "Priority support"], cta: "Get Early Access", featured: true },
    { name: "Empire", price: "$79", period: "/mo", desc: "For teams & agencies", features: ["Everything in Creator", "5 brand profiles", "Monetization Copilot", "API access", "Custom workflows", "Dedicated manager", "White-label options"], cta: "Contact Sales", featured: false },
  ];
  return (
    <section id="pricing" className="relative py-28">
      <div className="relative max-w-6xl mx-auto px-6">
        <Anim className="text-center mb-14">
          <p className="text-sm font-semibold tracking-widest uppercase text-brand-400 mb-3">Simple Pricing</p>
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">Start Free. Scale When Ready.</h2>
          <p className="text-lg text-dark-400">No surprises. No hidden fees. Cancel anytime.</p>
        </Anim>
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((p, i) => (
            <Anim key={p.name} delay={i * 0.1}>
              <div className={`relative p-7 rounded-2xl h-full flex flex-col glass ${p.featured ? "border-brand-500/30 shadow-lg shadow-brand-500/10" : ""}`}>
                {p.featured && <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r from-brand-600 to-blue-600">Most Popular</div>}
                <h3 className="text-xl font-bold text-white mb-1">{p.name}</h3>
                <p className="text-sm text-dark-500 mb-4">{p.desc}</p>
                <div className="mb-6"><span className="text-4xl font-black text-white">{p.price}</span><span className="text-dark-500">{p.period}</span></div>
                <ul className="space-y-3 mb-8 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm"><Check size={16} className="text-emerald-400 mt-0.5 shrink-0" /><span className="text-dark-300">{f}</span></li>
                  ))}
                </ul>
                <Button variant={p.featured ? "primary" : "secondary"} className="w-full">{p.cta}</Button>
              </div>
            </Anim>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── FAQ ───────────────────────────────────────────────── */
function FAQ() {
  const [open, setOpen] = useState<number | null>(null);
  const faqs = [
    { q: "How is CreatorAI different from ChatGPT or Jasper?", a: "CreatorAI isn't just an AI writer — it's a complete creator operating system. It learns YOUR voice, manages your content calendar, repurposes across platforms, tracks analytics, and helps you monetize. ChatGPT gives you text. We give you a creator empire." },
    { q: "Will the content actually sound like me?", a: "Yes. Our Brand DNA Engine analyzes your existing content, writing patterns, vocabulary, and tone to build a unique voice model. The more you use it, the better it gets." },
    { q: "What platforms does CreatorAI support?", a: "Twitter/X, Instagram, TikTok, YouTube, LinkedIn, newsletters, blogs, and podcasts. We add new platforms every month based on creator demand." },
    { q: "Can I try it for free?", a: "Absolutely. Our Starter plan is completely free — 5 AI-generated pieces per month, no credit card required. Upgrade only when you're ready." },
    { q: "Is my content private and secure?", a: "100%. We never train on your content, never share it, and never use it for any purpose other than serving you. Your Brand DNA and content are encrypted and private." },
  ];
  return (
    <section id="faq" className="py-28">
      <div className="max-w-3xl mx-auto px-6">
        <Anim className="text-center mb-14">
          <h2 className="text-4xl font-black text-white mb-4">Frequently Asked Questions</h2>
        </Anim>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <Anim key={i} delay={i * 0.04}>
              <div className="rounded-xl overflow-hidden glass">
                <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center justify-between p-5 text-left">
                  <span className="font-semibold text-white pr-4">{faq.q}</span>
                  <ChevronDown size={20} className={`text-dark-500 shrink-0 transition-transform duration-300 ${open === i ? "rotate-180" : ""}`} />
                </button>
                <motion.div initial={false} animate={{ height: open === i ? "auto" : 0, opacity: open === i ? 1 : 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                  <p className="px-5 pb-5 text-sm text-dark-400 leading-relaxed">{faq.a}</p>
                </motion.div>
              </div>
            </Anim>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── FINAL CTA ────────────────────────────────────────── */
function FinalCTA() {
  return (
    <section className="py-28">
      <div className="max-w-4xl mx-auto px-6">
        <Anim>
          <div className="relative rounded-3xl p-12 text-center overflow-hidden glass border-brand-500/20">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-500/10 to-blue-500/5" />
            <div className="relative">
              <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">Ready to Build Your<br /><span className="gradient-text">Creator Empire?</span></h2>
              <p className="text-lg text-dark-400 mb-8 max-w-xl mx-auto">Join 2,400+ creators on the waitlist. Be first in line when we launch.</p>
              <Link href="/signup"><Button size="lg">Get Early Access <ArrowRight size={20} className="ml-2" /></Button></Link>
              <p className="text-sm text-dark-500 mt-4">Free forever plan available · No credit card required</p>
            </div>
          </div>
        </Anim>
      </div>
    </section>
  );
}

/* ─── FOOTER ───────────────────────────────────────────── */
function Footer() {
  return (
    <footer className="py-12 border-t border-dark-800/50">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-blue-500 flex items-center justify-center"><Sparkles size={16} className="text-white" /></div>
          <span className="text-lg font-bold text-white">CreatorAI</span>
        </div>
        <div className="flex gap-6 text-sm text-dark-500">
          <a href="#" className="hover:text-white transition-colors">Privacy</a>
          <a href="#" className="hover:text-white transition-colors">Terms</a>
          <a href="#" className="hover:text-white transition-colors">Blog</a>
          <a href="#" className="hover:text-white transition-colors">Contact</a>
        </div>
        <p className="text-sm text-dark-600">© 2026 CreatorAI. All rights reserved.</p>
      </div>
    </footer>
  );
}

/* ─── PAGE ─────────────────────────────────────────────── */
export default function LandingPage() {
  return (
    <main>
      <Navbar />
      <Hero />
      <Features />
      <ToolsReplaced />
      <HowItWorks />
      <Testimonials />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}
