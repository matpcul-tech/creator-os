"use client";
import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && <label className="text-sm font-medium text-dark-300">{label}</label>}
        <input
          ref={ref}
          className={cn(
            "w-full px-4 py-3 rounded-xl bg-dark-800/50 border border-dark-700 text-white placeholder:text-dark-500",
            "focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all",
            error && "border-red-500 focus:ring-red-500/50",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";
