"use client";
import { cn } from "@/lib/utils";
import { ReactNode, ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

export function Button({ variant = "primary", size = "md", children, className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]",
        variant === "primary" && "bg-gradient-to-r from-brand-600 to-blue-600 text-white hover:shadow-lg hover:shadow-brand-500/25",
        variant === "secondary" && "glass text-white hover:bg-dark-700/60",
        variant === "ghost" && "text-dark-400 hover:text-white hover:bg-dark-800/50",
        size === "sm" && "px-4 py-2 text-sm",
        size === "md" && "px-6 py-3 text-sm",
        size === "lg" && "px-8 py-4 text-base",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
