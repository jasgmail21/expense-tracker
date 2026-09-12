import type { TxType } from "./types";
import { round2, toISO } from "./utils";

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

function ymd(y: number, m: number, d: number): string | null {
  if (y < 100) y += y < 70 ? 2000 : 1900;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1980 || y > 2100) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function parseDate(s: string): string | null {
  s = s.trim().replace(/[\u200e\u200f\u00a0]/g, "");
  if (!s) return null;

  let m = s.match(/^(\d{10})(\d{3})?$/);
  if (m) {
    const d = new Date(m[2] ? Number(s) : Number(s) * 1000);
    return isNaN(d.getTime()) ? null : toISO(d);
  }

  m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return ymd(Number(m[1]), Number(m[2]), Number(m[3]));

  m = s.match(/^(\d{1,2})[ \-/.]([A-Za-z]{3,9})[ \-/.]*(\d{2,4})$/);
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()])
    return ymd(Number(m[3]), MONTHS[m[2].slice(0, 3).toLowerCase()], Number(m[1]));

  m = s.match(/^([A-Za-z]{3,9})[ \-/.](\d{1,2}),?\s*(\d{2,4})$/);
  if (m && MONTHS[m[1].slice(0, 3).toLowerCase()])
    return ymd(Number(m[3]), MONTHS[m[1].slice(0, 3).toLowerCase()], Number(m[2]));

  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) {
    const a = Number(m[1]); const b = Number(m[2]); const y = Number(m[3]);
    if (a > 12 && b <= 12) return ymd(y, b, a);
    if (b > 12 && a <= 12) return ymd(y, a, b);
    return ymd(y, b, a) ?? ymd(y, a, b);
  }

  const d = new Date(s);
  if (!isNaN(d.getTime()) && d.getFullYear() > 1980 && d.getFullYear() < 2100) return toISO(d);
  return null;
}

export function parseAmount(s: string): number | null {
  let t = s.trim().replace(/[^\d.,\-+()]/g, "");
  if (!t) return null;
  const negParen = /^\(.*\)$/.test(t);
  if (t.includes(",") && t.includes(".")) {
    if (t.lastIndexOf(",") > t.lastIndexOf(".")) t = t.replace(/\./g, "").replace(/,/g, ".");
    else t = t.replace(/,/g, "");
  } else if (t.includes(",")) {
    t = /,\d{1,2}$/.test(t) ? t.replace(",", ".") : t.replace(/,/g, "");
  }
  const v = parseFloat(t);
  if (isNaN(v)) return null;
  return negParen ? -Math.abs(v) : v;
}

export function parseType(s: string | null, amount: number, allExpense: boolean): TxType {
  if (s) {
    const v = s.toLowerCase();
    if (/inflow|income|inc\b|dep\b|deposit|credit|cr\b|earned|salary|received|\bin\b/.test(v))
      return "income";
    if (/outflow|expense|exp\b|with\b|withdraw|debit|dr\b|spent|purchase|paid\b|\bout\b/.test(v))
      return "expense";
  }
  if (amount < 0) return "expense";
  return allExpense ? "expense" : "expense";
}

export function parsePayment(s: string | null): "cash" | "card" | undefined {
  if (!s) return undefined;
  const v = s.toLowerCase().trim();
  if (/cash|upi|gpay|paytm|phonepe/.test(v)) return "cash";
  if (/card|credit|debit|amex|visa|master/.test(v)) return "card";
  return undefined;
}

const NOTE_RULES: { re: RegExp; cat: string; type?: TxType }[] = [
  { re: /\bitr\b|tds|tax|challan/i, cat: "Taxes" },
  { re: /wedding|marriage|shaadi|lehnga|tent|\bdj\b/i, cat: "Celebrations" },
  { re: /dasvand|donat|charity|seva|gave\b/i, cat: "Charity & Giving" },
  { re: /rent|landlord|maintenance|society/i, cat: "Housing" },
  { re: /petrol|diesel|fuel|fasttag|toll|uber|ola|rapido|metro|auto|bike|car\b|i20|tyre|servic/i, cat: "Transport" },
  { re: /electricity|power|water|internet|wifi|broadband|recharge|gas\b|bill/i, cat: "Utilities" },
  { re: /sabji|vegetable|grocer|d\s?mart|bigbasket|blinkit|zepto|milk|ration|kirana|instamart|supermarket/i, cat: "Groceries" },
  { re: /pizza|dinner|lunch|breakfast|dhaba|restaurant|caf[ée]|coffee|chai|swiggy|zomato|biryani|food|cake|\beat\b/i, cat: "Dining Out" },
  { re: /flipkart|amazon|myntra|ajio|amway|shopping|mall|slipper|clothes|shoes|suits|shirt|dress|gift|payjama/i, cat: "Shopping" },
  { re: /doctor|medicine|pharmacy|hospital|gym|medical|clinic/i, cat: "Health" },
  { re: /movie|cinema|netflix|spotify|concert|party|subscription/i, cat: "Entertainment" },
  { re: /flight|hotel|trip|travel|vacation|irctc|airbnb/i, cat: "Travel" },
  { re: /salary|payroll|wages|bonus|variable/i, cat: "Salary", type: "income" },
  { re: /freelance|invoice|client/i, cat: "Freelance", type: "income" },
  { re: /dividend|interest|mutual|\bsip\b|\bmf\b|invest/i, cat: "Investments", type: "income" },
  { re: /reimburse|refund|cashback|wallet/i, cat: "Other Income", type: "income" },
];

export function inferCategory(note: string, type: TxType, cats: { name: string; type: TxType }[]): string | null {
  if (!note) return null;
  for (const rule of NOTE_RULES) {
    if (rule.re.test(note)) {
      if (rule.type && rule.type !== type) continue;
      const match = cats.find((c) => c.name.toLowerCase() === rule.cat.toLowerCase());
      if (match) return match.name;
      return rule.cat;
    }
  }
  return null;
}

export interface Mapping {
  date: number;
  amount: number;
  type: number;
  category: number;
  note: number;
  payment: number;
}

function guessMapping(headers: string[]): Mapping {
  const h = headers.map((x) => x.toLowerCase().trim());
  const findWord = (keys: string[], skip: number[] = []) => {
    for (let i = 0; i < h.length; i++) {
      if (skip.includes(i)) continue;
      const cell = h[i];
      for (const key of keys) {
        const re = new RegExp(`\\b${key}\\b`, "i");
        if (re.test(cell)) return i;
      }
    }
    return -1;
  };
  const date = findWord(["date", "day", "when", "time"]);
  const amount = findWord(["amount", "value", "sum", "total", "price", "cost"], [date]);
  const type = findWord(["type", "kind", "flow", "in/out", "direction"], [date, amount]);
  const category = findWord(["categor", "group", "tag", "class", "bucket"], [date, amount, type]);
  const note = findWord(["summary", "note", "desc", "memo", "detail", "item", "payee", "merchant", "label"], [date, amount, type, category]);
  const payment = findWord(["payment", "paid", "mode", "method", "via", "cash/card"], [date, amount, type, category, note]);
  return { date, amount, type, category, note, payment };
}

export interface ParsedTx {
  date: string;
  amount: number;
  type: TxType;
  categoryName: string;
  note: string;
  payment?: "cash" | "card";
  rowNumber?: number;
}

export interface Parsed {
  headers: string[];
  mapping: Mapping;
  sample: string[] | null;
  transactions: ParsedTx[];
  skipped: number;
  totalRows: number;
}

export function buildParsed(
  text: string,
  allExpense: boolean,
  noHeader: boolean,
  cats: { name: string; type: TxType }[]
): Parsed | null {
  const firstNl = text.indexOf("\n");
  const firstLine = firstNl === -1 ? text : text.slice(0, firstNl);
  if (firstLine.includes("\t")) text = text.replace(/\t/g, ",");
  const rows = parseCSV(text);
  if (rows.length === 0) return null;
  
  let detectedNoHeader = noHeader;
  if (!noHeader && rows.length > 0) {
    const firstCell = rows[0][0]?.trim() ?? "";
    if (parseDate(firstCell) || parseAmount(firstCell) !== null) {
      detectedNoHeader = true;
    }
  }
  
  if (!detectedNoHeader && rows.length < 2) return null;
  const headers = detectedNoHeader
    ? rows[0].map((_, i) => `Column ${i + 1}`)
    : rows[0].map((h, i) => h.trim() || `Column ${i + 1}`);
  const dataRows = detectedNoHeader ? rows : rows.slice(1);
  const mapping: Mapping = detectedNoHeader
    ? { date: 0, amount: Math.min(1, headers.length - 1), type: -1, category: -1, note: -1, payment: -1 }
    : guessMapping(headers);
  if (mapping.amount < 0) mapping.amount = headers.length > 1 ? 1 : 0;
  if (mapping.date < 0) mapping.date = 0;

  const readyCount = (m: Mapping) =>
    dataRows.reduce(
      (acc, r) =>
        parseDate(r[m.date] ?? "") && parseAmount(r[m.amount] ?? "") !== null ? acc + 1 : acc,
      0
    );
  if (dataRows.length > 0 && readyCount(mapping) === 0) {
    let best: Mapping | null = null;
    let bestScore = 0;
    for (let d = 0; d < headers.length; d++) {
      for (let a = 0; a < headers.length; a++) {
        if (a === d) continue;
        const cand: Mapping = { ...mapping, date: d, amount: a };
        const s = readyCount(cand);
        if (s > bestScore) {
          bestScore = s;
          best = cand;
        }
      }
    }
    if (best) Object.assign(mapping, best);
  }
  
  if (detectedNoHeader && dataRows.length > 0) {
    const usedCols = new Set([mapping.date, mapping.amount]);
    const sampleRow = dataRows[0];
    
    if (mapping.type < 0) {
      for (let i = 0; i < sampleRow.length; i++) {
        if (usedCols.has(i)) continue;
        const v = (sampleRow[i] ?? "").toLowerCase();
        if (/inflow|outflow|income|expense|in\b|out\b/.test(v)) {
          mapping.type = i;
          usedCols.add(i);
          break;
        }
      }
    }
    
    if (mapping.payment < 0) {
      for (let i = 0; i < sampleRow.length; i++) {
        if (usedCols.has(i)) continue;
        const v = (sampleRow[i] ?? "").toLowerCase();
        if (/cash|card|upi|gpay|paytm/.test(v)) {
          mapping.payment = i;
          usedCols.add(i);
          break;
        }
      }
    }
    
    if (mapping.note < 0) {
      for (let i = 0; i < sampleRow.length; i++) {
        if (usedCols.has(i)) continue;
        const v = (sampleRow[i] ?? "").trim();
        if (v && !parseDate(v) && parseAmount(v) === null) {
          mapping.note = i;
          usedCols.add(i);
          break;
        }
      }
    }
  }

  const out: ParsedTx[] = [];
  let skipped = 0;
  for (let i = 0; i < dataRows.length; i++) {
    const r = dataRows[i];
    const rawDate = r[mapping.date] ?? "";
    const rawAmount = r[mapping.amount] ?? "";
    const date = parseDate(rawDate);
    const amount = parseAmount(rawAmount);
    if (!date || amount === null || amount === 0) { skipped++; continue; }
    const type = parseType(mapping.type >= 0 ? r[mapping.type] : null, amount, allExpense);
    const note = (mapping.note >= 0 ? r[mapping.note] : "").trim();
    const rawCat = (mapping.category >= 0 ? r[mapping.category] : "").trim();
    const categoryName = rawCat || inferCategory(note, type, cats) || "Uncategorized";
    out.push({
      date,
      amount: round2(Math.abs(amount)),
      type,
      categoryName,
      note,
      payment: parsePayment(mapping.payment >= 0 ? r[mapping.payment] : null),
      rowNumber: detectedNoHeader ? i + 1 : i + 2,
    });
  }
  return {
    headers,
    mapping,
    sample: dataRows[0] ?? null,
    transactions: out,
    skipped,
    totalRows: dataRows.length,
  };
}

export function spreadsheetIdFromUrl(input: string): string | null {
  const t = input.trim();
  if (/^[a-zA-Z0-9-_]{20,}$/.test(t)) return t;
  const m = t.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : null;
}

export async function fetchSheetCSV(urlOrId: string, tabName?: string): Promise<string> {
  let u = urlOrId.trim();
  const id = spreadsheetIdFromUrl(u);
  const tab = tabName?.trim();
  if (id && !u.includes("output=csv") && !u.includes("tqx=out:csv")) {
    u = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv${tab ? `&sheet=${encodeURIComponent(tab)}` : ""}`;
  } else if (tab && u.includes("tqx=out:csv") && !u.includes("&sheet=") && !u.includes("?sheet=")) {
    u += `&sheet=${encodeURIComponent(tab)}`;
  }
  const res = await fetch(u);
  if (!res.ok) {
    throw new Error(
      `Google returned ${res.status}. Open the sheet → Share → "Anyone with the link" (Viewer) — or use File → Share → Publish to web → CSV.`
    );
  }
  const text = await res.text();
  if (text.trim().startsWith("<")) {
    throw new Error(
      "Google returned a web page instead of CSV. The tab may not exist, or the sheet isn't link-shared. Share → Anyone with the link, then retry."
    );
  }
  return text;
}
