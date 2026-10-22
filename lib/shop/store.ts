"use client";
import type { Product } from "./products";

const PRODUCTS = "creatoros.shop.products.v1";
const PICKS = "creatoros.shop.picks.v1";
const HOOKS = "creatoros.shop.hooks.v1";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
}

export const loadProducts = () => read<{ products: Product[]; source: string; example: boolean }>(PRODUCTS, { products: [], source: "", example: false });
export const saveProducts = (v: { products: Product[]; source: string; example: boolean }) => write(PRODUCTS, v);
export const loadPicks = () => read<Product[]>(PICKS, []);
export const savePicks = (v: Product[]) => write(PICKS, v);
export const loadHooks = () => read<string[]>(HOOKS, []);
export const rememberHook = (h: string) => write(HOOKS, [h, ...loadHooks().filter((x) => x !== h)].slice(0, 50));
