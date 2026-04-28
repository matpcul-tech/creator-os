import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export function Card({ children, className, hover = false }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl glass p-6",
        hover && "transition-all duration-300 hover:-translate-y-1 hover:border-brand-500/20 hover:shadow-lg hover:shadow-brand-500/5",
        className
      )}
    >
      {children}
    </div>
  );
}
