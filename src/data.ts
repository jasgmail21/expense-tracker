import type { Category, Transaction } from "./types";
import { mulberry32, round2, toISO } from "./utils";

export const SWATCHES = [
  "#3e8e5f",
  "#2f7e58",
  "#4e9e77",
  "#3fa5a0",
  "#31708e",
  "#4e7fb0",
  "#8a5fa0",
  "#c75d7a",
  "#cf4f36",
  "#b0563b",
  "#d97e36",
  "#c9a227",
];

export const ICON_CHOICES = [
  "cart",
  "utensils",
  "coffee",
  "car",
  "home",
  "bolt",
  "film",
  "pulse",
  "bag",
  "plane",
  "briefcase",
  "laptop",
  "trend",
  "coins",
  "receipt",
  "target",
];

export const DEFAULT_CATEGORIES: Category[] = [
  // Income
  { id: "cat-salary", name: "Salary", color: "#2f7e58", icon: "briefcase", type: "income" },
  { id: "cat-freelance", name: "Freelance", color: "#4f7ac2", icon: "laptop", type: "income" },
  { id: "cat-invest", name: "Investments", color: "#7a6bc9", icon: "trend", type: "income" },
  { id: "cat-other-income", name: "Other Income", color: "#3d8f8a", icon: "coins", type: "income" },

  // Expense
  { id: "cat-groceries", name: "Groceries", color: "#2f7e58", icon: "cart", type: "expense", budget: 8000 },
  { id: "cat-dining", name: "Dining Out", color: "#c2703e", icon: "utensils", type: "expense", budget: 4000 },
  { id: "cat-transport", name: "Transport", color: "#4f7ac2", icon: "car", type: "expense", budget: 5000 },
  { id: "cat-housing", name: "Housing", color: "#8a5a3b", icon: "home", type: "expense", budget: 20000 },
  { id: "cat-utilities", name: "Utilities", color: "#a3802c", icon: "bolt", type: "expense", budget: 3000 },
  { id: "cat-entertainment", name: "Entertainment", color: "#b64f6e", icon: "film", type: "expense", budget: 2000 },
  { id: "cat-shopping", name: "Shopping", color: "#7a6bc9", icon: "bag", type: "expense", budget: 5000 },
  { id: "cat-health", name: "Health", color: "#3d8f8a", icon: "pulse", type: "expense", budget: 2000 },
  { id: "cat-travel", name: "Travel", color: "#5b7f3b", icon: "plane", type: "expense" },
  { id: "cat-uncategorized", name: "Uncategorized", color: "#8a5a3b", icon: "receipt", type: "expense" },
];

const GROCERY_NOTES = ["Weekly vegetables", "BigBasket order", "DMart run", "Monthly staples", "Fruits & dairy"];
const DINING_NOTES = ["Pizza at Caldo", "Dinner at Dhaba", "Coffee at Barista", "Lunch with team", "Weekend brunch"];
const FREELANCE_CLIENTS = ["Northwind Studio", "Acme Corp", "Pixel Labs", "CodeCraft"];

export function buildSeedTransactions(): Transaction[] {
  const rand = mulberry32(42);
  const ri = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
  const rf = (min: number, max: number) => round2(rand() * (max - min) + min);
  const pick = <T>(arr: T[]) => arr[ri(0, arr.length - 1)];

  const txs: Transaction[] = [];
  const add = (day: number, type: "income" | "expense", cat: string, amount: number, note: string) => {
    const d = new Date();
    d.setDate(d.getDate() - day);
    txs.push({
      id: `seed-${txs.length}`,
      type,
      amount,
      categoryId: `cat-${cat}`,
      note,
      date: toISO(d),
      updatedAt: Date.now(),
    });
  };

  for (let back = 0; back < 6; back++) {
    // income
    add(back * 30 + 1, "income", "salary", 52000, "Monthly salary · Northwind Studio");
    if (back % 2 === 0)
      add(back * 30 + ri(14, 20), "income", "freelance", rf(6000, 15000), `Freelance sprint · ${pick(FREELANCE_CLIENTS)}`);
    if (back === 1 || back === 3) add(back * 30 + 20, "income", "invest", rf(450, 1100), "Dividends · index fund");

    // fixed expenses
    add(back * 30 + 2, "expense", "housing", 18000, "Rent · apartment");
    add(back * 30 + 6, "expense", "utilities", rf(900, 2200), "Power & water bill");
    add(back * 30 + 7, "expense", "utilities", 499, "Fiber internet");
    add(back * 30 + 3, "expense", "health", 1200, "Gym membership");

    // variable expenses
    for (let i = 0; i < 4; i++)
      if (rand() < 0.9) add(back * 30 + ri(3, 27), "expense", "groceries", rf(350, 1400), pick(GROCERY_NOTES));
    for (let i = 0; i < 3; i++)
      if (rand() < 0.85) add(back * 30 + ri(3, 27), "expense", "dining", rf(180, 900), pick(DINING_NOTES));
    add(back * 30 + ri(3, 25), "expense", "transport", 500, "Metro card top-up");
    if (rand() < 0.8) add(back * 30 + ri(3, 26), "expense", "transport", rf(1800, 3200), "Fuel");
    if (rand() < 0.7) add(back * 30 + ri(3, 26), "expense", "transport", rf(120, 350), "Rideshare home");
    add(back * 30 + 8, "expense", "entertainment", 199, "Streaming subscription");
    if (rand() < 0.8)
      add(back * 30 + ri(5, 26), "expense", "entertainment", rf(250, 800), pick(["Cinema tickets", "Live music night", "Museum pass"]));
    if (rand() < 0.75)
      add(back * 30 + ri(4, 26), "expense", "shopping", rf(400, 3500), pick(["Bookshop haul", "New running shoes", "Home goods", "Gift for Ana"]));
    if (rand() < 0.5) add(back * 30 + ri(4, 26), "expense", "health", rf(150, 900), "Pharmacy");
    if (back === 2) add(back * 30 + 18, "expense", "travel", 5400, "Weekend trip · Coorg");
    if (back === 4) add(back * 30 + 11, "expense", "travel", 7200, "Flights home");
  }

  return txs;
}
