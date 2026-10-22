"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ShoppingBag, Upload, FileText, Check, Video, Trash2 } from "lucide-react";
import { DEFAULT_WEIGHTS, SAMPLE_CSV_PATH, importProducts, scoreProducts, type Product, type Weights } from "@/lib/shop/products";
import { loadPicks, loadProducts, savePicks, saveProducts } from "@/lib/shop/store";

const money = (n: number) => (n ? `$${n.toFixed(2)}` : "n/a");

export default function ShopResearchPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [source, setSource] = useState("");
  const [example, setExample] = useState(false);
  const [picks, setPicks] = useState<Product[]>([]);
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [days, setDays] = useState(7);
  const [note, setNote] = useState("");
  const [category, setCategory] = useState("All");

  useEffect(() => {
    const saved = loadProducts();
    setProducts(saved.products);
    setSource(saved.source);
    setExample(saved.example);
    setPicks(loadPicks());
  }, []);

  function ingest(text: string, name: string, isExample: boolean) {
    const res = importProducts(text, days);
    if (!res.products.length) {
      setNote(`Could not read products from ${name}. Missing columns: ${res.missing.join(", ") || "none found"}.`);
      return;
    }
    setProducts(res.products);
    setSource(name);
    setExample(isExample);
    saveProducts({ products: res.products, source: name, example: isExample });
    setNote(
      `Imported ${res.products.length} products from ${name}.` +
        (res.missing.length ? ` Columns not found: ${res.missing.join(", ")} (scored as unknown).` : "") +
        (res.skipped ? ` Skipped ${res.skipped} empty rows.` : ""),
    );
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    ingest(await file.text(), file.name, false);
  }
  async function loadSample() {
    const text = await fetch(SAMPLE_CSV_PATH).then((r) => r.text());
    ingest(text, "Example data (not real sales)", true);
  }

  const categories = useMemo(() => ["All", ...Array.from(new Set(products.map((p) => p.category))).sort()], [products]);
  const ranked = useMemo(
    () => scoreProducts(products, weights).filter((p) => category === "All" || p.category === category),
    [products, weights, category],
  );
  const picked = new Set(picks.map((p) => p.id));

  function toggle(p: Product) {
    const next = picked.has(p.id) ? picks.filter((x) => x.id !== p.id) : [...picks, p];
    setPicks(next);
    savePicks(next);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-1 flex items-center gap-2"><ShoppingBag className="w-7 h-7" /> TikTok Shop research</h1>
        <p className="text-dark-400 max-w-3xl">
          Import a best seller export from FastMoss, Kalodata, EchoTik, or TikTok Creative Center Top Products, rank products by
          sales velocity, commission, price, and competition, then pick the ones to film. Data comes only from files you export. Nothing is scraped from TikTok.
        </p>
      </div>

      <div className="cai-card space-y-4">
        <div className="flex flex-wrap gap-3 items-center">
          <label className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-brand-600 to-blue-600 text-white cursor-pointer inline-flex items-center gap-2">
            <Upload className="w-4 h-4" /> Import CSV
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          <button onClick={loadSample} className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-dark-800 text-dark-200 inline-flex items-center gap-2">
            <FileText className="w-4 h-4" /> Load example data
          </button>
          <a href={SAMPLE_CSV_PATH} download className="text-sm text-brand-400 underline">Download example CSV</a>
          <label className="text-sm text-dark-300 flex items-center gap-2 ml-auto">
            Export covers
            <input type="number" min={1} max={90} value={days} onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 7))} className="cai-input w-20 py-1.5" />
            days (used when the file has no Days column)
          </label>
        </div>
        <p className="text-xs text-dark-500">
          Recognized columns: Product Name, Category, Price, Commission Rate, Units Sold (or Sales, Sales (7d)), Days, Growth, Creators (or Affiliates), Rating, Product Link.
        </p>
        {note ? <p className="text-sm text-dark-300">{note}</p> : null}
      </div>

      {example && products.length ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Example data: these products and numbers are made up to show how ranking works. Import a real export before choosing what to film.
        </div>
      ) : null}

      {products.length ? (
        <div className="cai-card space-y-3">
          <h2 className="text-lg font-semibold text-white">Ranking weights</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(Object.keys(weights) as (keyof Weights)[]).map((k) => (
              <label key={k} className="text-sm text-dark-300">
                <span className="capitalize">{k === "velocity" ? "Sales velocity" : k}</span>: {weights[k]}
                <input type="range" min={0} max={60} value={weights[k]} onChange={(e) => setWeights({ ...weights, [k]: Number(e.target.value) })} className="w-full" />
              </label>
            ))}
          </div>
          <p className="text-xs text-dark-500">Price scores best between $15 and $60. Competition compares creators already promoting to daily sales.</p>
        </div>
      ) : null}

      {picks.length ? (
        <div className="cai-card space-y-2">
          <h2 className="text-lg font-semibold text-white">Your picks ({picks.length})</h2>
          {picks.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-white flex-1 min-w-[12rem]">{p.name}</span>
              <Link href={`/shop/video?product=${encodeURIComponent(p.id)}`} className="px-3 py-1.5 rounded-lg bg-brand-600 text-white inline-flex items-center gap-1.5">
                <Video className="w-4 h-4" /> Make video
              </Link>
              <button onClick={() => toggle(p)} aria-label="Remove pick" className="text-dark-400"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      ) : null}

      {products.length ? (
        <div className="cai-card overflow-x-auto">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-lg font-semibold text-white">Ranked products</h2>
            <span className="text-xs text-dark-500">{source}</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="cai-input ml-auto w-auto py-1.5">
              {categories.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <table className="w-full text-sm">
            <thead className="text-dark-400 text-left">
              <tr>
                <th className="py-2 pr-3">#</th><th className="pr-3">Product</th><th className="pr-3">Score</th><th className="pr-3">Sold per day</th>
                <th className="pr-3">Price</th><th className="pr-3">Commission</th><th className="pr-3">You earn per sale</th><th className="pr-3">Creators</th><th />
              </tr>
            </thead>
            <tbody>
              {ranked.map((p, i) => (
                <tr key={p.id} className="border-t border-dark-800 text-dark-200">
                  <td className="py-2 pr-3 text-dark-500">{i + 1}</td>
                  <td className="pr-3"><div className="text-white">{p.name}</div><div className="text-xs text-dark-500">{p.category}{p.rating ? `, ${p.rating} stars` : ""}{p.growth ? `, growth ${p.growth}%` : ""}</div></td>
                  <td className="pr-3 font-semibold text-white">{p.score}</td>
                  <td className="pr-3">{Math.round(p.velocity).toLocaleString()}</td>
                  <td className="pr-3">{money(p.price)}</td>
                  <td className="pr-3">{p.commission ? `${p.commission}%` : "n/a"}</td>
                  <td className="pr-3">{money(p.earnPerSale)}</td>
                  <td className="pr-3">{p.creators || "n/a"}</td>
                  <td>
                    <button onClick={() => toggle(p)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 ${picked.has(p.id) ? "bg-emerald-600 text-white" : "bg-dark-800 text-dark-200"}`}>
                      {picked.has(p.id) ? <><Check className="w-3.5 h-3.5" /> Picked</> : "Pick"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="cai-card text-dark-400 text-sm">No products yet. Import a CSV export or load the example data to see how ranking works.</div>
      )}
    </div>
  );
}
