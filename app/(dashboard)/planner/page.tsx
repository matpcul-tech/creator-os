"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  KanbanSquare,
  Trash2,
  Calendar as CalIcon,
  X,
} from "lucide-react";
import { PLATFORMS, type PlatformId, PLATFORM_LIST } from "@/lib/platforms";
import { parseJSON, formatDate } from "@/lib/utils";

type Piece = {
  id: number;
  title: string;
  status: string;
  platforms: string;
  body: string;
  hook: string;
  cta: string;
  tags: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  notes: string;
  updatedAt: string;
};

const COLUMNS: { id: string; label: string; color: string }[] = [
  { id: "idea", label: "Idea", color: "from-slate-500 to-slate-600" },
  { id: "draft", label: "Draft", color: "from-amber-500 to-orange-500" },
  { id: "scheduled", label: "Scheduled", color: "from-blue-500 to-cyan-500" },
  { id: "published", label: "Published", color: "from-emerald-500 to-green-500" },
];

export default function PlannerPage() {
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Piece | null>(null);
  const [showNew, setShowNew] = useState(false);

  async function load() {
    const res = await fetch("/api/content");
    const data = await res.json();
    setPieces(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function move(piece: Piece, status: string) {
    setPieces((prev) =>
      prev.map((p) => (p.id === piece.id ? { ...p, status } : p)),
    );
    await fetch(`/api/content/${piece.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  async function update(id: number, patch: Partial<Omit<Piece, "platforms">> & { platforms?: string[] }) {
    await fetch(`/api/content/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await load();
    if (active && active.id === id) {
      const fresh = (await (await fetch(`/api/content/${id}`)).json()) as Piece;
      setActive(fresh);
    }
  }

  async function remove(id: number) {
    await fetch(`/api/content/${id}`, { method: "DELETE" });
    setPieces((prev) => prev.filter((p) => p.id !== id));
    setActive(null);
  }

  async function create(data: { title: string }) {
    const res = await fetch("/api/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: data.title, status: "idea" }),
    });
    if (res.ok) {
      setShowNew(false);
      await load();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Planner</h1>
          <p className="text-dark-400">
            Move content from idea → draft → scheduled → published. Click a card to edit.
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 text-white text-sm font-semibold hover:shadow-lg hover:shadow-brand-500/25 transition-all flex items-center gap-2"
        >
          <Plus size={16} /> New piece
        </button>
      </div>

      {showNew ? <NewPieceForm onCreate={create} onCancel={() => setShowNew(false)} /> : null}

      {loading ? (
        <div className="text-dark-500 text-sm">Loading…</div>
      ) : pieces.length === 0 ? (
        <div className="cai-card text-center py-16">
          <KanbanSquare size={36} className="text-dark-700 mx-auto mb-3" />
          <p className="text-white font-semibold">No content yet</p>
          <p className="text-sm text-dark-500 mt-1">
            Create a piece, or promote an Idea from the Ideas tab.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {COLUMNS.map((col) => (
            <Column
              key={col.id}
              col={col}
              pieces={pieces.filter((p) => p.status === col.id)}
              onSelect={setActive}
              onMove={move}
            />
          ))}
        </div>
      )}

      {active ? (
        <PieceDrawer
          piece={active}
          onClose={() => setActive(null)}
          onSave={(patch) => update(active.id, patch)}
          onDelete={() => remove(active.id)}
        />
      ) : null}
    </div>
  );
}

function Column({
  col,
  pieces,
  onSelect,
  onMove,
}: {
  col: { id: string; label: string; color: string };
  pieces: Piece[];
  onSelect: (p: Piece) => void;
  onMove: (p: Piece, s: string) => void;
}) {
  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        const id = Number(e.dataTransfer.getData("text/plain"));
        const piece = pieces.find((p) => p.id === id);
        if (piece) return; // already in this column
        const fromOther = (e.dataTransfer.getData("text/plain"));
        if (!fromOther) return;
        // We don't know the piece object here; rely on parent's pieces for reload
      }}
      className="rounded-2xl bg-dark-900/40 border border-dark-800/50 p-3 min-h-[300px]"
    >
      <div className="flex items-center justify-between px-2 py-2 mb-2">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full bg-gradient-to-br ${col.color}`} />
          <span className="text-sm font-semibold text-white">{col.label}</span>
        </div>
        <span className="text-xs text-dark-500 px-2 py-0.5 rounded-full bg-dark-800/50">
          {pieces.length}
        </span>
      </div>
      <div className="space-y-2">
        {pieces.map((p) => (
          <PieceCard key={p.id} piece={p} onSelect={() => onSelect(p)} onMove={(s) => onMove(p, s)} />
        ))}
        {pieces.length === 0 ? (
          <div className="text-center py-6 text-xs text-dark-600 italic">Empty</div>
        ) : null}
      </div>
    </div>
  );
}

function PieceCard({
  piece,
  onSelect,
  onMove,
}: {
  piece: Piece;
  onSelect: () => void;
  onMove: (status: string) => void;
}) {
  const platforms = parseJSON<string[]>(piece.platforms, []);
  return (
    <div
      onClick={onSelect}
      className="rounded-xl bg-dark-800/40 border border-dark-700/40 p-3 cursor-pointer hover:border-brand-500/30 hover:bg-dark-800/60 transition-all"
    >
      <p className="text-sm font-medium text-white line-clamp-2">{piece.title}</p>
      {piece.hook ? (
        <p className="text-xs text-dark-500 mt-1 line-clamp-2">"{piece.hook}"</p>
      ) : null}
      <div className="flex items-center justify-between mt-3">
        <div className="flex gap-1">
          {platforms.slice(0, 4).map((p) => {
            const plat = PLATFORMS[p as PlatformId];
            if (!plat) return null;
            const Icon = plat.icon;
            return (
              <span key={p} className="text-dark-400" title={plat.name}>
                <Icon size={12} />
              </span>
            );
          })}
        </div>
        {piece.scheduledAt ? (
          <span className="text-[10px] text-dark-500 flex items-center gap-1">
            <CalIcon size={10} />
            {formatDate(piece.scheduledAt)}
          </span>
        ) : null}
      </div>
      <div
        className="grid grid-cols-4 gap-1 mt-2 pt-2 border-t border-dark-700/30"
        onClick={(e) => e.stopPropagation()}
      >
        {COLUMNS.map((c) => {
          const active = c.id === piece.status;
          return (
            <button
              key={c.id}
              onClick={() => !active && onMove(c.id)}
              disabled={active}
              className={`text-[10px] py-1 rounded transition-colors ${
                active
                  ? "bg-brand-500/20 text-brand-400 cursor-default"
                  : "text-dark-500 hover:text-white hover:bg-dark-700/40"
              }`}
              title={`Move to ${c.label}`}
            >
              {c.label.slice(0, 4)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NewPieceForm({
  onCreate,
  onCancel,
}: {
  onCreate: (d: { title: string }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  return (
    <div className="cai-card">
      <h3 className="text-base font-bold text-white mb-3">New content piece</h3>
      <div className="flex gap-2">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What's the working title?"
          className="cai-input flex-1"
          onKeyDown={(e) => e.key === "Enter" && title && onCreate({ title })}
        />
        <button
          onClick={() => title && onCreate({ title })}
          className="px-4 py-2 rounded-xl bg-brand-500/15 text-brand-400 border border-brand-500/30 text-sm font-medium hover:bg-brand-500/25 transition-all"
        >
          Create
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-xl text-sm text-dark-400 hover:text-white transition-all"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function PieceDrawer({
  piece,
  onClose,
  onSave,
  onDelete,
}: {
  piece: Piece;
  onClose: () => void;
  onSave: (patch: Partial<Omit<Piece, "platforms">> & { platforms?: string[] }) => Promise<void>;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(piece.title);
  const [hook, setHook] = useState(piece.hook);
  const [cta, setCta] = useState(piece.cta);
  const [body, setBody] = useState(piece.body);
  const [notes, setNotes] = useState(piece.notes);
  const [platforms, setPlatforms] = useState<string[]>(
    parseJSON<string[]>(piece.platforms, []),
  );
  const [scheduledAt, setScheduledAt] = useState(
    piece.scheduledAt ? piece.scheduledAt.slice(0, 16) : "",
  );

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-2xl bg-dark-950 border-l border-dark-800 overflow-y-auto">
        <div className="sticky top-0 bg-dark-950 border-b border-dark-800 px-6 py-4 flex items-center justify-between z-10">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-xl font-bold text-white bg-transparent border-none outline-none flex-1"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={onDelete}
              className="p-2 rounded-lg text-dark-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              <Trash2 size={16} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-800/50 transition-all"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <Field label="Hook (first line)">
            <input value={hook} onChange={(e) => setHook(e.target.value)} className="cai-input" />
          </Field>
          <Field label="CTA">
            <input value={cta} onChange={(e) => setCta(e.target.value)} className="cai-input" />
          </Field>
          <Field label="Platforms">
            <div className="flex flex-wrap gap-2">
              {PLATFORM_LIST.map((p) => {
                const Icon = p.icon;
                const active = platforms.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() =>
                      setPlatforms((prev) =>
                        prev.includes(p.id)
                          ? prev.filter((x) => x !== p.id)
                          : [...prev, p.id],
                      )
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border flex items-center gap-1.5 ${
                      active
                        ? "bg-brand-500/15 border-brand-500/40 text-brand-400"
                        : "bg-dark-800/30 border-dark-700/40 text-dark-400 hover:text-white"
                    }`}
                  >
                    <Icon size={12} />
                    {p.name}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="Scheduled at">
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="cai-input"
            />
          </Field>
          <Field label="Master draft">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="cai-input min-h-[300px] font-mono text-sm"
            />
          </Field>
          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="cai-input min-h-[80px]"
            />
          </Field>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-dark-800">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm text-dark-400 hover:text-white transition-all"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                await onSave({
                  title,
                  hook,
                  cta,
                  body,
                  notes,
                  platforms,
                  scheduledAt: scheduledAt
                    ? new Date(scheduledAt).toISOString()
                    : null,
                });
                onClose();
              }}
              className="px-4 py-2 rounded-xl bg-brand-500/20 text-brand-300 border border-brand-500/40 text-sm font-medium hover:bg-brand-500/30 transition-all"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wider font-semibold text-dark-500 mb-1.5 block">
        {label}
      </label>
      {children}
    </div>
  );
}
