import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";

export function OnboardingBanner() {
  return (
    <Link
      href="/onboarding"
      className="block mb-6 group rounded-2xl p-5 border border-brand-500/30 bg-gradient-to-br from-brand-500/10 via-blue-500/5 to-transparent hover:border-brand-500/50 transition-all"
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500 to-blue-500 flex items-center justify-center shrink-0">
          <Sparkles size={22} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">
            Finish setting up your creator profile
          </p>
          <p className="text-xs text-dark-400 mt-0.5">
            Tell CreatorAI about your niche, audience, and voice. Every AI feature
            uses this — without it, generations are generic. Takes 5 minutes.
          </p>
        </div>
        <div className="flex items-center gap-1 text-sm font-medium text-brand-400 group-hover:translate-x-1 transition-transform shrink-0">
          Start <ArrowRight size={16} />
        </div>
      </div>
    </Link>
  );
}
