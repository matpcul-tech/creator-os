import Link from "next/link";
import {
  Sparkles,
  Calendar as CalIcon,
  ArrowRight,
  Lightbulb,
  KanbanSquare,
  Wand2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatCents, formatNumber, parseJSON, relativeTime } from "@/lib/utils";
import { PLATFORMS, type PlatformId } from "@/lib/platforms";

export const dynamic = "force-dynamic";

async function getStats() {
  const startOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  );

  const [
    profile,
    ideaCount,
    draftCount,
    scheduledCount,
    publishedCount,
    upcoming,
    recentPublished,
    recentIdeas,
    revenueAgg,
    sponsorActive,
    contactCount,
    snapshots,
  ] = await Promise.all([
    prisma.profile.findFirst(),
    prisma.idea.count({ where: { archived: false } }),
    prisma.contentPiece.count({ where: { status: "draft" } }),
    prisma.contentPiece.count({ where: { status: "scheduled" } }),
    prisma.contentPiece.count({ where: { status: "published" } }),
    prisma.contentPiece.findMany({
      where: { status: "scheduled" },
      orderBy: { scheduledAt: "asc" },
      take: 5,
    }),
    prisma.contentPiece.findMany({
      where: { status: "published" },
      orderBy: { publishedAt: "desc" },
      take: 4,
    }),
    prisma.idea.findMany({
      where: { archived: false },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.revenueEntry.aggregate({
      _sum: { amount: true },
      where: { date: { gte: startOfMonth } },
    }),
    prisma.sponsor.count({
      where: { status: { in: ["pitched", "negotiating", "booked", "live"] } },
    }),
    prisma.contact.count(),
    prisma.analyticsSnapshot.findMany({
      orderBy: { capturedAt: "desc" },
      take: 30,
    }),
  ]);

  const totalFollowers = snapshots.reduce(
    (acc, s) => Math.max(acc, s.followers),
    0,
  );

  return {
    profile,
    ideaCount,
    draftCount,
    scheduledCount,
    publishedCount,
    upcoming,
    recentPublished,
    recentIdeas,
    revenueMonth: revenueAgg._sum.amount ?? 0,
    sponsorActive,
    contactCount,
    totalFollowers,
  };
}

export default async function DashboardPage() {
  const s = await getStats();
  const platforms = parseJSON<string[]>(s.profile?.platforms, []);
  const greeting = s.profile?.name ? `, ${s.profile.name.split(" ")[0]}` : "";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">
            Welcome back{greeting} 👋
          </h1>
          <p className="text-dark-400">
            {s.profile?.onboardedAt
              ? "Here's the state of your creator practice."
              : "Set up your profile to unlock AI-powered features."}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/ideas"
            className="px-4 py-2.5 rounded-xl glass text-sm font-medium hover:border-brand-500/30 transition-all flex items-center gap-2"
          >
            <Lightbulb size={16} /> New idea
          </Link>
          <Link
            href="/studio"
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 text-white text-sm font-semibold hover:shadow-lg hover:shadow-brand-500/25 transition-all flex items-center gap-2"
          >
            <Wand2 size={16} /> Open Studio
          </Link>
        </div>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat label="Ideas in bank" value={String(s.ideaCount)} icon={Lightbulb} color="from-amber-500 to-orange-500" href="/ideas" />
        <Stat label="In draft" value={String(s.draftCount)} icon={KanbanSquare} color="from-brand-500 to-purple-500" href="/planner" />
        <Stat label="Scheduled" value={String(s.scheduledCount)} icon={CalIcon} color="from-blue-500 to-cyan-500" href="/calendar" />
        <Stat label="Published" value={String(s.publishedCount)} icon={Sparkles} color="from-emerald-500 to-green-500" href="/planner" />
      </div>

      {/* Main grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Up next */}
        <div className="lg:col-span-2 cai-card">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-white">Up next</h2>
            <Link href="/calendar" className="text-sm text-brand-400 hover:text-brand-300">Open calendar →</Link>
          </div>

          {s.upcoming.length === 0 ? (
            <Empty title="Nothing scheduled." hint="Schedule a draft from the planner, or write something new in the studio." />
          ) : (
            <div className="space-y-2">
              {s.upcoming.map((c) => {
                const plats = parseJSON<string[]>(c.platforms, []);
                return (
                  <Link key={c.id} href={`/planner?id=${c.id}`} className="flex items-center justify-between p-4 rounded-xl hover:bg-dark-800/40 transition-all group">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate group-hover:text-brand-400 transition-colors">{c.title}</p>
                      <div className="text-xs text-dark-500 mt-1 flex items-center gap-2">
                        <span>{formatScheduleTime(c.scheduledAt)}</span>
                        <span>·</span>
                        <span className="flex gap-1">
                          {plats.map((p) => {
                            const Icon = PLATFORMS[p as PlatformId]?.icon;
                            return Icon ? <Icon key={p} size={12} className="text-dark-400" /> : null;
                          })}
                        </span>
                      </div>
                    </div>
                    <ArrowRight size={16} className="text-dark-600 group-hover:text-brand-400 transition-colors shrink-0" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Profile snapshot */}
        <div className="cai-card">
          <h2 className="text-lg font-bold text-white mb-4">Your studio</h2>
          <dl className="space-y-3 text-sm">
            <Row label="Niche" value={s.profile?.niche} />
            <Row label="Audience" value={s.profile?.audience} />
            <Row label="Cadence" value={s.profile ? `${s.profile.weeklyCadence} posts / week` : ""} />
          </dl>
          <div className="mt-4">
            <div className="text-xs text-dark-500 mb-2">Platforms</div>
            <div className="flex flex-wrap gap-1.5">
              {platforms.length === 0 ? (
                <span className="text-dark-500 text-sm">None set</span>
              ) : (
                platforms.map((p) => {
                  const plat = PLATFORMS[p as PlatformId];
                  if (!plat) return null;
                  const Icon = plat.icon;
                  return (
                    <span key={p} className="cai-chip">
                      <Icon size={12} />{plat.name}
                    </span>
                  );
                })
              )}
            </div>
          </div>
          <Link href="/onboarding" className="mt-5 block text-center w-full py-2.5 rounded-xl text-sm text-brand-400 hover:bg-brand-500/10 transition-all border border-brand-500/20">
            Edit profile →
          </Link>
        </div>
      </div>

      {/* Triple row */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="cai-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Latest ideas</h2>
            <Link href="/ideas" className="text-sm text-brand-400 hover:text-brand-300">All →</Link>
          </div>
          {s.recentIdeas.length === 0 ? (
            <Empty title="No ideas yet." hint="Generate a batch with Claude in Ideas." />
          ) : (
            <ul className="space-y-3">
              {s.recentIdeas.map((i) => (
                <li key={i.id}>
                  <p className="text-sm font-medium text-white line-clamp-2">{i.title}</p>
                  {i.hook ? <p className="text-xs text-dark-500 mt-1 line-clamp-2">{i.hook}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="cai-card">
          <h2 className="text-lg font-bold text-white mb-4">Money</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-dark-500">This month</div>
              <div className="text-3xl font-bold text-white mt-1">{formatCents(s.revenueMonth)}</div>
            </div>
            <div>
              <div className="text-xs text-dark-500">Active sponsors</div>
              <div className="text-3xl font-bold text-white mt-1">{s.sponsorActive}</div>
            </div>
          </div>
          <Link href="/monetize" className="mt-5 block text-center w-full py-2.5 rounded-xl text-sm text-brand-400 hover:bg-brand-500/10 transition-all border border-brand-500/20">
            Open monetization →
          </Link>
        </div>

        <div className="cai-card">
          <h2 className="text-lg font-bold text-white mb-4">Audience</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-dark-500">Followers</div>
              <div className="text-3xl font-bold text-white mt-1">{s.totalFollowers ? formatNumber(s.totalFollowers) : "—"}</div>
            </div>
            <div>
              <div className="text-xs text-dark-500">Contacts</div>
              <div className="text-3xl font-bold text-white mt-1">{s.contactCount}</div>
            </div>
          </div>
          <Link href="/audience" className="mt-5 block text-center w-full py-2.5 rounded-xl text-sm text-brand-400 hover:bg-brand-500/10 transition-all border border-brand-500/20">
            Open audience →
          </Link>
        </div>
      </div>

      {/* Recently published */}
      {s.recentPublished.length > 0 ? (
        <div className="cai-card">
          <h2 className="text-lg font-bold text-white mb-4">Recently published</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {s.recentPublished.map((c) => {
              const plats = parseJSON<string[]>(c.platforms, []);
              return (
                <Link key={c.id} href={`/planner?id=${c.id}`} className="p-4 rounded-xl bg-dark-800/30 border border-dark-700/40 hover:border-brand-500/30 transition-all">
                  <p className="text-sm font-medium text-white line-clamp-2">{c.title}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-dark-500">
                    <span>{relativeTime(c.publishedAt)}</span>
                    <span className="flex gap-1">
                      {plats.map((p) => {
                        const Icon = PLATFORMS[p as PlatformId]?.icon;
                        return Icon ? <Icon key={p} size={11} /> : null;
                      })}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({
  label, value, icon: Icon, color, href,
}: {
  label: string; value: string;
  icon: LucideIcon;
  color: string; href: string;
}) {
  return (
    <Link href={href} className="glass rounded-2xl p-5 group hover:border-brand-500/20 transition-all">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center`}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-dark-500 mt-1">{label}</p>
    </Link>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-dark-500">{label}</dt>
      <dd className="text-sm text-white text-right truncate max-w-[200px]">
        {value || <span className="text-dark-600">—</span>}
      </dd>
    </div>
  );
}

function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="text-center py-8">
      <p className="text-sm font-medium text-white">{title}</p>
      <p className="text-xs text-dark-500 mt-1">{hint}</p>
    </div>
  );
}

function formatScheduleTime(d: Date | null): string {
  if (!d) return "Unscheduled";
  const date = new Date(d);
  const diff = date.getTime() - Date.now();
  const hours = diff / (1000 * 60 * 60);
  if (hours < 0) return "Overdue";
  if (hours < 24) return `Today ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  if (hours < 48) return `Tomorrow ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
