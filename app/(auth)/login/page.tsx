"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Demo: redirect to dashboard
    window.location.href = "/dashboard";
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 20%, rgba(124,58,237,0.1), #020617 70%)" }}>
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center justify-center gap-2 mb-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-blue-500 flex items-center justify-center">
            <Sparkles size={20} className="text-white" />
          </div>
          <span className="text-2xl font-bold text-white">Creator<span className="gradient-text">AI</span></span>
        </Link>

        <div className="glass rounded-2xl p-8">
          <h1 className="text-2xl font-bold text-white mb-1">Welcome back</h1>
          <p className="text-dark-400 text-sm mb-8">Log in to your creator dashboard</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-dark-300 mb-1.5 block">Email</label>
              <div className="relative">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-500" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-dark-800/50 border border-dark-700 text-white placeholder:text-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all" />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-dark-300 mb-1.5 block">Password</label>
              <div className="relative">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-500" />
                <input type={showPass ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required
                  className="w-full pl-11 pr-12 py-3 rounded-xl bg-dark-800/50 border border-dark-700 text-white placeholder:text-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all" />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-dark-500 hover:text-dark-300">
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-dark-400">
                <input type="checkbox" className="rounded border-dark-700 bg-dark-800" />
                Remember me
              </label>
              <a href="#" className="text-brand-400 hover:text-brand-300">Forgot password?</a>
            </div>

            <Button type="submit" className="w-full" size="lg">
              Log In <ArrowRight size={18} className="ml-2" />
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-dark-500">
              Don&apos;t have an account? <Link href="/signup" className="text-brand-400 hover:text-brand-300 font-medium">Sign up free</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
