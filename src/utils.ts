import type { Category, Transaction } from "./types";

export const CURRENCIES = [
  { code: "INR", label: "Indian Rupee (₹)" },
  { code: "USD", label: "US Dollar ($)" },
  { code: "EUR", label: "Euro (€)" },
  { code: "GBP", label: "British Pound (£)" },
  { code: "JPY", label: "Japanese Yen (¥)" },
  { code: "AUD", label: "Australian Dollar (A$)" },
  { code: "CAD", label: "Canadian Dollar (C$)" },
];

export function fmtMoney(
  n: number,
  currency: string,
  opts: { compact?: boolean; decimals?: boolean } = {}
): string {
  const abs = Math.abs(n);
  const decimals: number = opts.decimals === false ? 2 : (abs >= 1000 ? 0 : 2);
  try {
    const formatOpts: Intl.NumberFormatOptions = {
      style: "currency",
      currency,
      minimumFractionDigits: opts.compact ? 0 : decimals,
      maximumFractionDigits: opts.compact ? 1 : decimals,
    };
    if (opts.compact && abs >= 10000) {
      formatOpts.notation = "compact";
    }
    return new Intl.NumberFormat(undefined, formatOpts).format(n);
  } catch {
    return `₹${n.toFixed(2)}`;
  }
}

export function fmtSigned(t: Pick<Transaction, "type" | "amount">, currency: string): string {
  return `${t.type === "income" ? "+" : "−"}${fmtMoney(t.amount, currency)}`;
}

export function fmtPct(n: number, digits = 0): string {
  return `${n > 0 ? "+" : ""}${n.toFixed(digits)}%`;
}

export function fmtAgo(ts: number): string {
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

export function toISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export const todayISO = (): string => toISO(new Date());

export function monthKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export const currentMonthKey = (): string => monthKeyOf(new Date());

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKeyOf(d);
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function monthShort(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short" });
}

export function dayLabel(iso: string): string {
  const d = fromISO(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (toISO(today) === iso) return "Today";
  if (toISO(yest) === iso) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function niceDate(iso: string): string {
  return fromISO(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function daysInMonthKey(key: string): number {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function exportCSV(txs: Transaction[], categories: Category[], currency: string): void {
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? id;
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const header = ["Date", "Type", "Category", "Note", `Amount (${currency})`];
  const rows = [...txs]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((t) =>
      [t.date, t.type, catName(t.categoryId), esc(t.note), (t.type === "expense" ? -t.amount : t.amount).toFixed(2)].join(",")
    );
  const blob = new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sprout-transactions-${todayISO()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
