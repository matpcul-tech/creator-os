import { Sidebar } from "@/components/dashboard/Sidebar";
import { OnboardingBanner } from "@/components/dashboard/OnboardingBanner";
import { prisma } from "@/lib/db";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await prisma.profile.findFirst().catch(() => null);
  const onboarded = !!profile?.onboardedAt;

  return (
    <div className="flex min-h-screen bg-dark-950">
      <Sidebar creatorName={profile?.name || undefined} />
      {/* pt-14 on mobile clears the fixed top bar; full padding returns at md */}
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
        <div className="p-4 md:p-8">
          {!onboarded ? <OnboardingBanner /> : null}
          {children}
        </div>
      </main>
    </div>
  );
}
