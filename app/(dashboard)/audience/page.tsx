"use client";

import { useEffect, useState } from "react";
import { Users, Plus, X, Trash2, Mail } from "lucide-react";
import { formatDate } from "@/lib/utils";

type Contact = {
  id: number;
  name: string;
  handle: string;
  email: string;
  type: string;
  platform: string;
  notes: string;
  lastTouchAt: string | null;
};

const TYPES = [
  { id: "fan", label: "Top fan", color: "bg-pink-500/15 text-pink-400 border-pink-500/30" },
  {
    id: "collab",
    label: "Collaborator",
    color: "bg-brand-500/15 text-brand-400 border-brand-500/30",
  },
  {
    id: "sponsor",
    label: "Sponsor contact",
    color: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  },
  {
    id: "media",
    label: "Media / journalist",
    color: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  },
  {
    id: "other",
    label: "Other",
    color: "bg-dark-700/40 text-dark-400 border-dark-700",
  },
];

export default function AudiencePage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  async function load() {
    const data = await (await fetch("/api/contacts")).json();
    setContacts(data);
  }
  useEffect(() => {
    load();
  }, []);

  const filtered =
    filter === "all" ? contacts : contacts.filter((c) => c.type === filter);

  async function touchNow(c: Contact) {
    await fetch(`/api/contacts/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lastTouchAt: new Date().toISOString() }),
    });
    await load();
  }

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Audience</h1>
          <p className="text-dark-400">
            Your top fans, collaborators, and sponsor contacts in one place. Stay in touch.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 text-white text-sm font-semibold hover:shadow-lg hover:shadow-brand-500/25 transition-all flex items-center gap-2"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />} Add contact
        </button>
      </div>

      {showForm ? (
        <ContactForm
          onCreate={async (data) => {
            await fetch("/api/contacts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            });
            await load();
            setShowForm(false);
          }}
        />
      ) : null}

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            filter === "all"
              ? "bg-brand-500/20 text-brand-400"
              : "text-dark-500 hover:text-white"
          }`}
        >
          All ({contacts.length})
        </button>
        {TYPES.map((t) => {
          const n = contacts.filter((c) => c.type === t.id).length;
          if (n === 0) return null;
          return (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filter === t.id
                  ? "bg-brand-500/20 text-brand-400"
                  : "text-dark-500 hover:text-white"
              }`}
            >
              {t.label} ({n})
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="cai-card text-center py-12">
          <Users size={36} className="text-dark-700 mx-auto mb-3" />
          <p className="text-white font-semibold">No contacts yet</p>
          <p className="text-sm text-dark-500 mt-1">
            Add a top fan, a sponsor lead, or a collab partner to start your CRM.
          </p>
        </div>
      ) : (
        <div className="cai-card">
          <div className="space-y-1">
            <div className="grid grid-cols-12 gap-3 px-3 py-2 text-[10px] uppercase tracking-wider font-semibold text-dark-500">
              <span className="col-span-3">Name</span>
              <span className="col-span-2">Type</span>
              <span className="col-span-3">Handle / Email</span>
              <span className="col-span-2">Last touch</span>
              <span className="col-span-2 text-right">Actions</span>
            </div>
            {filtered.map((c) => {
              const t = TYPES.find((x) => x.id === c.type) ?? TYPES[TYPES.length - 1];
              return (
                <div
                  key={c.id}
                  className="grid grid-cols-12 gap-3 px-3 py-3 rounded-xl text-sm hover:bg-dark-800/40 transition-all items-center group"
                >
                  <div className="col-span-3">
                    <p className="text-white font-medium">{c.name}</p>
                    {c.notes ? (
                      <p className="text-xs text-dark-500 mt-0.5 line-clamp-1">{c.notes}</p>
                    ) : null}
                  </div>
                  <div className="col-span-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${t.color}`}>
                      {t.label}
                    </span>
                  </div>
                  <div className="col-span-3 text-xs text-dark-400">
                    {c.handle ? <div>@{c.handle}</div> : null}
                    {c.email ? <div className="text-dark-500">{c.email}</div> : null}
                  </div>
                  <div className="col-span-2 text-xs text-dark-500">
                    {c.lastTouchAt ? formatDate(c.lastTouchAt) : "Never"}
                  </div>
                  <div className="col-span-2 flex items-center justify-end gap-1">
                    <button
                      onClick={() => touchNow(c)}
                      className="text-[10px] px-2 py-1 rounded bg-brand-500/15 text-brand-400 hover:bg-brand-500/25 transition-all opacity-0 group-hover:opacity-100"
                    >
                      Touch now
                    </button>
                    {c.email ? (
                      <a
                        href={`mailto:${c.email}`}
                        className="p-1.5 rounded text-dark-500 hover:text-white"
                      >
                        <Mail size={12} />
                      </a>
                    ) : null}
                    <button
                      onClick={async () => {
                        await fetch(`/api/contacts/${c.id}`, { method: "DELETE" });
                        await load();
                      }}
                      className="p-1.5 rounded text-dark-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ContactForm({
  onCreate,
}: {
  onCreate: (d: {
    name: string;
    handle: string;
    email: string;
    type: string;
    platform: string;
    notes: string;
  }) => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: "",
    handle: "",
    email: "",
    type: "fan",
    platform: "",
    notes: "",
  });

  return (
    <div className="cai-card">
      <h3 className="text-base font-bold text-white mb-3">New contact</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Name *"
          className="cai-input"
        />
        <select
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
          className="cai-input"
        >
          {TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <input
          value={form.handle}
          onChange={(e) => setForm({ ...form, handle: e.target.value })}
          placeholder="Handle (without @)"
          className="cai-input"
        />
        <input
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="Email"
          className="cai-input"
        />
        <textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Notes"
          className="cai-input sm:col-span-2 min-h-[80px]"
        />
      </div>
      <button
        onClick={() => form.name && onCreate(form)}
        disabled={!form.name}
        className="mt-3 px-4 py-2 rounded-xl bg-brand-500/20 text-brand-300 border border-brand-500/40 text-sm font-medium hover:bg-brand-500/30 transition-all disabled:opacity-50"
      >
        Save contact
      </button>
    </div>
  );
}
