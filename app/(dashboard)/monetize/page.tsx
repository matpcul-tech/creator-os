"use client";

import { useEffect, useState } from "react";
import {
  DollarSign,
  Plus,
  X,
  Trash2,
  Briefcase,
  Star,
  TrendingUp,
  FileText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatCents, formatDate } from "@/lib/utils";

type Sponsor = {
  id: number;
  brand: string;
  contactName: string;
  contactEmail: string;
  status: string;
  amount: number;
  deliverables: string;
  dueDate: string | null;
  notes: string;
};

type Revenue = {
  id: number;
  source: string;
  label: string;
  amount: number;
  date: string;
  notes: string;
};

const SPONSOR_STATUS = [
  { id: "prospect", label: "Prospect", color: "from-slate-500 to-slate-600" },
  { id: "pitched", label: "Pitched", color: "from-amber-500 to-orange-500" },
  {
    id: "negotiating",
    label: "Negotiating",
    color: "from-blue-500 to-cyan-500",
  },
  { id: "booked", label: "Booked", color: "from-purple-500 to-fuchsia-500" },
  { id: "live", label: "Live", color: "from-brand-500 to-purple-500" },
  { id: "done", label: "Done", color: "from-emerald-500 to-green-500" },
  { id: "lost", label: "Lost", color: "from-red-500 to-rose-500" },
];

const SOURCE_META: Record<
  string,
  { label: string; icon: LucideIcon; color: string }
> = {
  sponsor: { label: "Sponsor", icon: Briefcase, color: "from-brand-500 to-purple-500" },
  product: { label: "Product", icon: FileText, color: "from-blue-500 to-cyan-500" },
  affiliate: { label: "Affiliate", icon: TrendingUp, color: "from-emerald-500 to-green-500" },
  platform: { label: "Platform payout", icon: Star, color: "from-amber-500 to-orange-500" },
};

export default function MonetizePage() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [revenue, setRevenue] = useState<Revenue[]>([]);
  const [showSponsor, setShowSponsor] = useState(false);
  const [showRevenue, setShowRevenue] = useState(false);

  async function load() {
    const [s, r] = await Promise.all([
      (await fetch("/api/sponsors")).json(),
      (await fetch("/api/revenue")).json(),
    ]);
    setSponsors(s);
    setRevenue(r);
  }
  useEffect(() => {
    load();
  }, []);

  const startOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  );
  const monthRev = revenue
    .filter((r) => new Date(r.date) >= startOfMonth)
    .reduce((acc, r) => acc + r.amount, 0);

  const bySource: Record<string, number> = {};
  revenue
    .filter((r) => new Date(r.date) >= startOfMonth)
    .forEach((r) => {
      bySource[r.source] = (bySource[r.source] ?? 0) + r.amount;
    });

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Monetization</h1>
          <p className="text-dark-400">
            Track sponsorship pipeline, revenue, and product income.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setShowSponsor((v) => !v);
              setShowRevenue(false);
            }}
            className="px-4 py-2.5 rounded-xl glass text-sm font-medium hover:border-brand-500/30 transition-all flex items-center gap-2"
          >
            {showSponsor ? <X size={16} /> : <Plus size={16} />} Sponsor
          </button>
          <button
            onClick={() => {
              setShowRevenue((v) => !v);
              setShowSponsor(false);
            }}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 text-white text-sm font-semibold hover:shadow-lg hover:shadow-brand-500/25 transition-all flex items-center gap-2"
          >
            {showRevenue ? <X size={16} /> : <Plus size={16} />} Revenue
          </button>
        </div>
      </div>

      {/* Forms */}
      {showSponsor ? (
        <SponsorForm
          onCreate={async (d) => {
            await fetch("/api/sponsors", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(d),
            });
            await load();
            setShowSponsor(false);
          }}
        />
      ) : null}
      {showRevenue ? (
        <RevenueForm
          onCreate={async (d) => {
            await fetch("/api/revenue", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(d),
            });
            await load();
            setShowRevenue(false);
          }}
        />
      ) : null}

      {/* This month */}
      <div className="cai-card border-brand-500/20 text-center py-10">
        <p className="text-sm text-dark-400 mb-1">Estimated this month</p>
        <p className="text-5xl font-black text-white mb-2">{formatCents(monthRev)}</p>
        <p className="text-sm text-dark-500">{revenue.length} total entries logged</p>
      </div>

      {/* Source breakdown */}
      {Object.keys(bySource).length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(bySource).map(([source, amount]) => {
            const meta = SOURCE_META[source] ?? SOURCE_META.sponsor;
            const Icon = meta.icon;
            return (
              <div key={source} className="cai-card">
                <div
                  className={`w-10 h-10 rounded-xl bg-gradient-to-br ${meta.color} flex items-center justify-center mb-3`}
                >
                  <Icon size={20} className="text-white" />
                </div>
                <p className="text-2xl font-bold text-white">{formatCents(amount)}</p>
                <p className="text-xs text-dark-500 mt-1">{meta.label}</p>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Sponsor pipeline */}
      <div className="cai-card">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">Sponsor pipeline</h2>
          <span className="text-xs text-dark-500">{sponsors.length} total</span>
        </div>

        {sponsors.length === 0 ? (
          <div className="text-center py-12">
            <Briefcase size={36} className="text-dark-700 mx-auto mb-3" />
            <p className="text-white font-semibold">No sponsors yet</p>
            <p className="text-sm text-dark-500 mt-1">Add a prospect to start tracking outreach.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-3">
            {SPONSOR_STATUS.map((status) => {
              const items = sponsors.filter((s) => s.status === status.id);
              if (items.length === 0) return null;
              return (
                <div
                  key={status.id}
                  className="rounded-xl bg-dark-800/30 border border-dark-700/30 p-3"
                >
                  <div className="flex items-center justify-between mb-2 px-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full bg-gradient-to-br ${status.color}`}
                      />
                      <span className="text-xs font-semibold text-white">
                        {status.label}
                      </span>
                    </div>
                    <span className="text-[10px] text-dark-500">{items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {items.map((s) => (
                      <SponsorCard
                        key={s.id}
                        sponsor={s}
                        onMove={async (newStatus) => {
                          await fetch(`/api/sponsors/${s.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ status: newStatus }),
                          });
                          await load();
                        }}
                        onDelete={async () => {
                          await fetch(`/api/sponsors/${s.id}`, { method: "DELETE" });
                          await load();
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Revenue log */}
      <div className="cai-card">
        <h2 className="text-lg font-bold text-white mb-5">Revenue log</h2>
        {revenue.length === 0 ? (
          <div className="text-center py-12">
            <DollarSign size={36} className="text-dark-700 mx-auto mb-3" />
            <p className="text-white font-semibold">No revenue logged</p>
            <p className="text-sm text-dark-500 mt-1">
              Add entries as you get paid — sponsorships, products, affiliates.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="grid grid-cols-5 gap-3 px-3 py-2 text-[10px] uppercase tracking-wider font-semibold text-dark-500">
              <span>Date</span>
              <span>Source</span>
              <span className="col-span-2">Label</span>
              <span className="text-right">Amount</span>
            </div>
            {revenue.map((r) => {
              const meta = SOURCE_META[r.source] ?? SOURCE_META.sponsor;
              return (
                <div
                  key={r.id}
                  className="grid grid-cols-5 gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-dark-800/40 transition-all items-center group"
                >
                  <span className="text-dark-400 text-xs">{formatDate(r.date)}</span>
                  <span className="text-dark-300 text-xs flex items-center gap-1.5">
                    <meta.icon size={12} />
                    {meta.label}
                  </span>
                  <span className="col-span-2 text-white font-medium">{r.label}</span>
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-emerald-400 font-bold">{formatCents(r.amount)}</span>
                    <button
                      onClick={async () => {
                        await fetch(`/api/revenue/${r.id}`, { method: "DELETE" });
                        await load();
                      }}
                      className="p-1 rounded text-dark-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SponsorCard({
  sponsor,
  onMove,
  onDelete,
}: {
  sponsor: Sponsor;
  onMove: (status: string) => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-xl bg-dark-900/60 border border-dark-700/40 p-3 group">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-white truncate">{sponsor.brand}</p>
        <button
          onClick={onDelete}
          className="p-1 rounded text-dark-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
        >
          <Trash2 size={12} />
        </button>
      </div>
      {sponsor.contactName ? (
        <p className="text-[10px] text-dark-500 truncate mt-0.5">{sponsor.contactName}</p>
      ) : null}
      {sponsor.amount > 0 ? (
        <p className="text-xs text-emerald-400 font-medium mt-1">{formatCents(sponsor.amount)}</p>
      ) : null}
      <select
        value={sponsor.status}
        onChange={(e) => onMove(e.target.value)}
        className="w-full mt-2 px-2 py-1 rounded-lg text-[10px] bg-dark-800/60 border border-dark-700/40 text-dark-300"
      >
        {SPONSOR_STATUS.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function SponsorForm({
  onCreate,
}: {
  onCreate: (d: {
    brand: string;
    contactName: string;
    contactEmail: string;
    amount: number;
    deliverables: string;
    notes: string;
  }) => Promise<void>;
}) {
  const [form, setForm] = useState({
    brand: "",
    contactName: "",
    contactEmail: "",
    amount: 0,
    deliverables: "",
    notes: "",
  });
  return (
    <div className="cai-card">
      <h3 className="text-base font-bold text-white mb-3">New sponsor</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        <input
          value={form.brand}
          onChange={(e) => setForm({ ...form, brand: e.target.value })}
          placeholder="Brand name *"
          className="cai-input"
        />
        <input
          value={form.contactName}
          onChange={(e) => setForm({ ...form, contactName: e.target.value })}
          placeholder="Contact person"
          className="cai-input"
        />
        <input
          value={form.contactEmail}
          onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
          placeholder="Contact email"
          className="cai-input"
        />
        <input
          type="number"
          value={form.amount / 100 || ""}
          onChange={(e) => setForm({ ...form, amount: Math.round(Number(e.target.value) * 100) })}
          placeholder="Amount in dollars"
          className="cai-input"
        />
        <input
          value={form.deliverables}
          onChange={(e) => setForm({ ...form, deliverables: e.target.value })}
          placeholder="Deliverables"
          className="cai-input sm:col-span-2"
        />
      </div>
      <button
        onClick={() => form.brand && onCreate(form)}
        disabled={!form.brand}
        className="mt-3 px-4 py-2 rounded-xl bg-brand-500/20 text-brand-300 border border-brand-500/40 text-sm font-medium hover:bg-brand-500/30 transition-all disabled:opacity-50"
      >
        Add sponsor
      </button>
    </div>
  );
}

function RevenueForm({
  onCreate,
}: {
  onCreate: (d: {
    source: string;
    label: string;
    amount: number;
    notes: string;
  }) => Promise<void>;
}) {
  const [form, setForm] = useState({
    source: "sponsor",
    label: "",
    amount: 0,
    notes: "",
  });
  return (
    <div className="cai-card">
      <h3 className="text-base font-bold text-white mb-3">New revenue entry</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        <select
          value={form.source}
          onChange={(e) => setForm({ ...form, source: e.target.value })}
          className="cai-input"
        >
          {Object.entries(SOURCE_META).map(([id, meta]) => (
            <option key={id} value={id}>
              {meta.label}
            </option>
          ))}
        </select>
        <input
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
          placeholder="Label *"
          className="cai-input"
        />
        <input
          type="number"
          step="0.01"
          value={form.amount / 100 || ""}
          onChange={(e) => setForm({ ...form, amount: Math.round(Number(e.target.value) * 100) })}
          placeholder="Amount in dollars *"
          className="cai-input"
        />
      </div>
      <button
        onClick={() => form.label && form.amount > 0 && onCreate(form)}
        disabled={!form.label || form.amount <= 0}
        className="mt-3 px-4 py-2 rounded-xl bg-brand-500/20 text-brand-300 border border-brand-500/40 text-sm font-medium hover:bg-brand-500/30 transition-all disabled:opacity-50"
      >
        Add entry
      </button>
    </div>
  );
}
