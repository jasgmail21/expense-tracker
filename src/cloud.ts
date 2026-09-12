import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildParsed, fetchSheetCSV } from "./importer";
import type { Category, CloudConfig, SheetConfig, Transaction } from "./types";
import { uid } from "./utils";

const CFG_KEY = "sprout.cloud.config";
const TOMB_KEY = "sprout.cloud.tombstones";

export const SCHEMA_SQL = `-- Sprout ledger schema
create table if not exists public.transactions (
  id text primary key,
  user_id uuid not null,
  type text not null check (type in ('income','expense')),
  amount numeric(12,2) not null check (amount >= 0),
  category_id text not null,
  note text not null default '',
  date date not null,
  payment text,
  source_ref text,
  updated_at bigint not null default 0
);
alter table public.transactions add column if not exists payment text;
alter table public.transactions add column if not exists source_ref text;
create unique index if not exists idx_transactions_source_ref on public.transactions(user_id, source_ref) where source_ref is not null;

create table if not exists public.categories (
  id text primary key,
  user_id uuid not null,
  name text not null,
  color text not null,
  icon text not null,
  type text not null check (type in ('income','expense')),
  budget numeric(12,2),
  updated_at bigint not null default 0
);

create table if not exists public.settings (
  user_id uuid primary key,
  currency text not null default 'INR',
  sheet_config text,
  updated_at bigint not null default 0
);
alter table public.settings add column if not exists sheet_config text;

create table if not exists public.sheet_inbox (
  id bigint generated always as identity primary key,
  date date,
  kind text default 'expense',
  category text default 'Uncategorized',
  note text default '',
  amount numeric(12,2),
  payment text,
  source_ref text,
  created_at timestamptz default now()
);
alter table public.sheet_inbox add column if not exists payment text;
alter table public.sheet_inbox add column if not exists source_ref text;

alter table public.transactions enable row level security;
alter table public.categories enable row level security;
alter table public.settings enable row level security;
alter table public.sheet_inbox enable row level security;

create policy "own transactions" on public.transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own categories" on public.categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own settings" on public.settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sheet insert" on public.sheet_inbox for insert to anon with check (true);
create policy "sheet read" on public.sheet_inbox for select to authenticated using (true);
create policy "sheet clear" on public.sheet_inbox for delete to authenticated using (true);
`;

export function loadCloudConfig(): CloudConfig | null {
  try {
    const raw = localStorage.getItem(CFG_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as CloudConfig;
    if (c && c.url && c.anonKey) return c;
  } catch { /* ignore */ }
  return null;
}

export function saveCloudConfig(c: CloudConfig | null): void {
  try {
    if (c) localStorage.setItem(CFG_KEY, JSON.stringify(c));
    else localStorage.removeItem(CFG_KEY);
  } catch { /* ignore */ }
}

export function makeClient(cfg: CloudConfig): SupabaseClient {
  return createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
}

interface Tombstone {
  table: "transactions" | "categories";
  id: string;
  at: number;
}

export function addTombstone(t: Tombstone): void {
  try {
    const list = loadTombstones();
    list.push(t);
    localStorage.setItem(TOMB_KEY, JSON.stringify(list));
  } catch { /* ignore */ }
}

function loadTombstones(): Tombstone[] {
  try {
    return JSON.parse(localStorage.getItem(TOMB_KEY) ?? "[]") as Tombstone[];
  } catch {
    return [];
  }
}

function takeTombstones(): Tombstone[] {
  const list = loadTombstones();
  try {
    localStorage.removeItem(TOMB_KEY);
  } catch { /* ignore */ }
  return list;
}

interface TxRow {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  category_id: string;
  note: string;
  date: string;
  payment: string | null;
  source_ref: string | null;
  updated_at: number;
}

interface CatRow {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string;
  type: string;
  budget: number | null;
  updated_at: number;
}

const txToRow = (t: Transaction, userId: string): TxRow => ({
  id: t.id,
  user_id: userId,
  type: t.type,
  amount: t.amount,
  category_id: t.categoryId,
  note: t.note,
  date: t.date,
  payment: t.payment ?? null,
  source_ref: t.sourceRef ?? null,
  updated_at: t.updatedAt ?? 0,
});

const rowToTx = (r: TxRow): Transaction => ({
  id: r.id,
  type: r.type === "income" ? "income" : "expense",
  amount: Number(r.amount),
  categoryId: r.category_id,
  note: r.note ?? "",
  date: typeof r.date === "string" ? r.date.slice(0, 10) : String(r.date),
  payment: r.payment === "cash" || r.payment === "card" ? r.payment : undefined,
  sourceRef: r.source_ref ?? undefined,
  updatedAt: Number(r.updated_at ?? 0),
});

const catToRow = (c: Category, userId: string): CatRow => ({
  id: c.id,
  user_id: userId,
  name: c.name,
  color: c.color,
  icon: c.icon,
  type: c.type,
  budget: c.budget ?? null,
  updated_at: c.updatedAt ?? 0,
});

const rowToCat = (r: CatRow): Category => ({
  id: r.id,
  name: r.name,
  color: r.color,
  icon: r.icon,
  type: r.type === "income" ? "income" : "expense",
  budget: r.budget == null ? undefined : Number(r.budget),
  updatedAt: Number(r.updated_at ?? 0),
});

const FALLBACK_COLORS = ["#2f7e58", "#c2703e", "#4f7ac2", "#b64f6e", "#7a6bc9", "#3d8f8a", "#a3802c", "#8a5a3b", "#5b7f3b", "#c05a4e"];

function parseSheetConfig(raw: string | null | undefined): SheetConfig | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<SheetConfig>;
    if (p && typeof p.spreadsheetId === "string") {
      return {
        spreadsheetId: p.spreadsheetId,
        tabName: typeof p.tabName === "string" ? p.tabName : "",
        enabled: !!p.enabled,
      };
    }
  } catch { /* ignore */ }
  return null;
}

export interface SyncInput {
  transactions: Transaction[];
  categories: Category[];
  currency: string;
  settingsUpdatedAt: number;
  sheet?: SheetConfig | null;
}

export interface SyncResult extends SyncInput {
  ingestedFromSheet: number;
  pulledFromSheet: number;
  sheetError: string | null;
}

export interface DirtyFlags {
  tx: Set<string>;
  cat: Set<string>;
  settings: boolean;
}

export async function syncAll(
  client: SupabaseClient,
  userId: string,
  local: SyncInput,
  dirty: DirtyFlags
): Promise<SyncResult> {
  const [txRes, catRes, setRes, inboxRes] = await Promise.all([
    client.from("transactions").select("*").eq("user_id", userId),
    client.from("categories").select("*").eq("user_id", userId),
    client.from("settings").select("*").eq("user_id", userId).maybeSingle(),
    client.from("sheet_inbox").select("*").order("id", { ascending: true }),
  ]);
  if (txRes.error) throw new Error(`transactions: ${txRes.error.message}`);
  if (catRes.error) throw new Error(`categories: ${catRes.error.message}`);
  if (setRes.error) throw new Error(`settings: ${setRes.error.message}`);

  const cloudTx = new Map<string, Transaction>(
    ((txRes.data ?? []) as TxRow[]).map((r) => [r.id, rowToTx(r)])
  );
  const cloudCat = new Map<string, Category>(
    ((catRes.data ?? []) as CatRow[]).map((r) => [r.id, rowToCat(r)])
  );
  const cloudSet = setRes.data as {
    currency: string;
    sheet_config?: string | null;
    updated_at: number;
  } | null;

  const tombs = takeTombstones();
  const tombTx = new Map(tombs.filter((t) => t.table === "transactions").map((t) => [t.id, t.at]));
  const tombCat = new Map(tombs.filter((t) => t.table === "categories").map((t) => [t.id, t.at]));
  const txToDelete: string[] = [];
  const catToDelete: string[] = [];
  tombTx.forEach((at, id) => {
    const c = cloudTx.get(id);
    if (c && (c.updatedAt ?? 0) <= at) {
      cloudTx.delete(id);
      txToDelete.push(id);
    }
  });
  tombCat.forEach((at, id) => {
    const c = cloudCat.get(id);
    if (c && (c.updatedAt ?? 0) <= at) {
      cloudCat.delete(id);
      catToDelete.push(id);
    }
  });

  const pushTx: Transaction[] = [];
  const mergedTx = new Map<string, Transaction>(cloudTx);
  for (const t of local.transactions) {
    if (dirty.tx.has(t.id)) {
      mergedTx.set(t.id, t);
      pushTx.push(t);
    }
  }

  const cloudHasCategories = cloudCat.size > 0;
  const pushCat: Category[] = [];
  const mergedCat = new Map<string, Category>(cloudCat);
  for (const c of local.categories) {
    const isDirty = dirty.cat.has(c.id);
    const isNewDefault = !cloudHasCategories && !cloudCat.has(c.id);
    if (isDirty || isNewDefault) {
      mergedCat.set(c.id, c);
      pushCat.push(c);
    }
  }

  let ingested = 0;
  const inboxRows = inboxRes.error
    ? []
    : ((inboxRes.data ?? []) as {
        id: number;
        date: string | null;
        kind: string | null;
        category: string | null;
        note: string | null;
        amount: number | null;
        payment: string | null;
        source_ref: string | null;
      }[]);

  if (inboxRows.length > 0) {
    const now = Date.now();
    const existingBySource = new Map<string, Transaction>();
    for (const t of mergedTx.values()) {
      if (t.sourceRef) {
        existingBySource.set(t.sourceRef, t);
      }
    }

    const inboxBySource = new Map<string, typeof inboxRows>();
    for (const r of inboxRows) {
      const key = r.source_ref ?? `no_source_${r.id}`;
      if (!inboxBySource.has(key)) {
        inboxBySource.set(key, []);
      }
      inboxBySource.get(key)!.push(r);
    }

    const allInboxIds: number[] = [];
    for (const rows of inboxBySource.values()) {
      rows.sort((a, b) => b.id - a.id);
      const latest = rows[0];
      
      for (const row of rows) {
        allInboxIds.push(row.id);
      }

      const amount = Math.abs(Number(latest.amount));
      if (!latest.date || isNaN(amount) || amount <= 0) {
        continue;
      }
      const type = /inc|dep|credit/i.test(latest.kind ?? "") ? "income" : "expense";
      const name = (latest.category ?? "").trim() || "Uncategorized";
      const note = (latest.note ?? "").trim() || "From Google Sheet";
      const date = String(latest.date).slice(0, 10);
      const sourceRef = latest.source_ref ?? undefined;
      const payment = latest.payment === "cash" || latest.payment === "card" ? latest.payment : undefined;

      let cat = Array.from(mergedCat.values()).find(
        (c) => c.name.toLowerCase() === name.toLowerCase() && c.type === type
      );
      if (!cat) {
        let hash = 0;
        for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
        cat = {
          id: `cat-${uid()}`,
          name,
          type,
          color: FALLBACK_COLORS[hash % FALLBACK_COLORS.length],
          icon: "coins",
          updatedAt: now,
        };
        mergedCat.set(cat.id, cat);
        pushCat.push(cat);
      }

      const existing = sourceRef ? existingBySource.get(sourceRef) : undefined;
      if (existing) {
        existing.type = type;
        existing.amount = amount;
        existing.categoryId = cat.id;
        existing.note = note;
        existing.date = date;
        existing.payment = payment;
        existing.updatedAt = now + ingested;
        pushTx.push(existing);
      } else {
        const tx: Transaction = {
          id: uid(),
          type,
          amount,
          categoryId: cat.id,
          note,
          date,
          payment,
          sourceRef,
          updatedAt: now + ingested,
        };
        mergedTx.set(tx.id, tx);
        pushTx.push(tx);
        if (sourceRef) {
          existingBySource.set(sourceRef, tx);
        }
      }
      ingested++;
    }
    
    if (allInboxIds.length > 0) {
      await client.from("sheet_inbox").delete().in("id", allInboxIds);
    }
  }

  let pulled = 0;
  let sheetError: string | null = null;
  if (local.sheet?.enabled && local.sheet.spreadsheetId) {
    try {
      const csv = await fetchSheetCSV(local.sheet.spreadsheetId, local.sheet.tabName || undefined);
      const parsed = buildParsed(csv, true, false, Array.from(mergedCat.values()));
      if (parsed) {
        const existingBySource = new Map<string, Transaction>();
        for (const t of mergedTx.values()) {
          if (t.sourceRef) {
            existingBySource.set(t.sourceRef, t);
          }
        }
        const now = Date.now();
        let i = 0;
        for (let rowIdx = 0; rowIdx < parsed.transactions.length && rowIdx < 2500; rowIdx++) {
          const pt = parsed.transactions[rowIdx];
          const rowNum = pt.rowNumber ?? (rowIdx + 2);
          const sourceRef = `sheet:${local.sheet.tabName || "default"}:row_${rowNum}`;

          let cat = Array.from(mergedCat.values()).find(
            (c) => c.name.toLowerCase() === pt.categoryName.toLowerCase() && c.type === pt.type
          );
          if (!cat) {
            let hash = 0;
            for (const ch of pt.categoryName) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
            cat = {
              id: `cat-${uid()}`,
              name: pt.categoryName.replace(/^\w/, (c) => c.toUpperCase()),
              type: pt.type,
              color: FALLBACK_COLORS[hash % FALLBACK_COLORS.length],
              icon: "coins",
              updatedAt: now,
            };
            mergedCat.set(cat.id, cat);
            pushCat.push(cat);
          }

          const existing = existingBySource.get(sourceRef);
          if (existing) {
            existing.type = pt.type;
            existing.amount = pt.amount;
            existing.categoryId = cat.id;
            existing.note = pt.note || `From Google Sheet${local.sheet.tabName ? ` · ${local.sheet.tabName}` : ""}`;
            existing.date = pt.date;
            existing.payment = pt.payment;
            existing.updatedAt = now + i;
            pushTx.push(existing);
          } else {
            const tx: Transaction = {
              id: uid(),
              type: pt.type,
              amount: pt.amount,
              categoryId: cat.id,
              note: pt.note || `From Google Sheet${local.sheet.tabName ? ` · ${local.sheet.tabName}` : ""}`,
              date: pt.date,
              payment: pt.payment,
              sourceRef,
              updatedAt: now + i,
            };
            mergedTx.set(tx.id, tx);
            pushTx.push(tx);
            existingBySource.set(sourceRef, tx);
          }
          i++;
          pulled++;
        }
      }
    } catch (e) {
      sheetError = e instanceof Error ? e.message : "could not fetch the sheet";
    }
  }

  let currency = local.currency;
  let sheetCfg: SheetConfig | null = local.sheet ?? null;
  let settingsUpdatedAt = local.settingsUpdatedAt;
  const cloudSheet = parseSheetConfig(cloudSet?.sheet_config ?? null);
  const cloudSetAt = Number(cloudSet?.updated_at ?? 0);
  let pushSettings = dirty.settings || !cloudSet;
  if (cloudSet && cloudSetAt > settingsUpdatedAt) {
    currency = cloudSet.currency;
    sheetCfg = cloudSheet;
    settingsUpdatedAt = cloudSetAt;
    pushSettings = false;
  }

  const writes: PromiseLike<unknown>[] = [];
  if (pushTx.length)
    writes.push(client.from("transactions").upsert(pushTx.map((t) => txToRow(t, userId))));
  if (pushCat.length)
    writes.push(client.from("categories").upsert(pushCat.map((c) => catToRow(c, userId))));
  if (pushSettings)
    writes.push(
      client.from("settings").upsert({
        user_id: userId,
        currency,
        sheet_config: sheetCfg ? JSON.stringify(sheetCfg) : null,
        updated_at: settingsUpdatedAt,
      })
    );
  if (txToDelete.length)
    writes.push(client.from("transactions").delete().in("id", txToDelete));
  if (catToDelete.length)
    writes.push(client.from("categories").delete().in("id", catToDelete));

  const results = await Promise.all(writes);
  for (const r of results) {
    const err = (r as { error?: { message: string } | null }).error;
    if (err) throw new Error(err.message);
  }

  return {
    transactions: Array.from(mergedTx.values()),
    categories: Array.from(mergedCat.values()),
    currency,
    settingsUpdatedAt,
    sheet: sheetCfg,
    ingestedFromSheet: ingested,
    pulledFromSheet: pulled,
    sheetError,
  };
}
