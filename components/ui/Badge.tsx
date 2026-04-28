import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  variant?: "default" | "success" | "warning" | "premium";
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        variant === "default" && "bg-brand-500/10 text-brand-400 border border-brand-500/20",
        variant === "success" && "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
        variant === "warning" && "bg-amber-500/10 text-amber-400 border border-amber-500/20",
        variant === "premium" && "bg-gradient-to-r from-brand-500/20 to-blue-500/20 text-white border border-brand-500/30",
        className
      )}
    >
      {children}
    </span>
  );
}
