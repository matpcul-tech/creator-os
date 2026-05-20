"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-dark-900 border border-dark-800 rounded-2xl p-6 space-y-4">
        <h1 className="text-xl font-semibold text-white">Something went wrong</h1>
        <p className="text-sm text-dark-400">
          An unexpected error occurred. You can retry, or head back to the dashboard.
        </p>
        {error.digest ? (
          <p className="text-xs text-dark-500 font-mono">Ref: {error.digest}</p>
        ) : null}
        <div className="flex gap-2">
          <Button onClick={() => reset()}>Try again</Button>
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center font-semibold rounded-xl px-6 py-3 text-sm glass text-white hover:bg-dark-700/60 transition-all"
          >
            Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
