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
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          {!onboarded ? <OnboardingBanner /> : null}
          {children}
        </div>
      </main>
    </div>
  );
}
