import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <p className="text-sm text-dark-500 font-mono">404</p>
        <h1 className="text-2xl font-semibold text-white">Page not found</h1>
        <p className="text-sm text-dark-400">
          The page you're looking for doesn't exist or was moved.
        </p>
        <div className="pt-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center font-semibold rounded-xl px-6 py-3 text-sm bg-gradient-to-r from-brand-600 to-blue-600 text-white hover:shadow-lg hover:shadow-brand-500/25 transition-all"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
