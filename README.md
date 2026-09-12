# Sprout - Personal Finance Tracker

A beautiful, modern personal finance tracker built with React, TypeScript, and Tailwind CSS. Features cloud sync with Supabase, Google Sheets integration, and a stunning neo-brutalist design.

## ✨ Features

### Core Features
- **Transaction Management**: Track income and expenses with categories, notes, and payment methods
- **Budget Tracking**: Set monthly budgets for each category with visual progress indicators
- **Cloud Sync**: Real-time synchronization across devices using Supabase
- **Google Sheets Integration**: 
  - Import transactions from CSV or Google Sheets
  - Live sync from Google Sheets (pull mode)
  - Apps Script push integration
- **Source-Based Deduplication**: Stable transaction identity using source references
- **Multiple Views**: Overview, Transactions, Budgets, and Insights

### Overview Dashboard
- **Month/All-Time Toggle**: Switch between monthly and all-time views
- **Month Picker**: Click month title to jump to any month/year instantly
- **Category Drill-Down**: Click pie chart segments to see all transactions in that category
- **Visual Charts**: Donut chart, flow bars, sparklines, and rank bars
- **Key Metrics**: Net balance, savings rate, income/expense breakdown

### Transactions View
- **Advanced Filtering**: Search, type filter, category filter, month filter
- **Grouped by Date**: Transactions organized by day with daily totals
- **Quick Actions**: Edit and delete with hover actions
- **CSV Export**: Export filtered transactions

### Budgets View
- **Visual Progress**: Color-coded budget bars (green/amber/red)
- **Inline Editing**: Click budget amount to edit
- **Category Management**: Add, edit, and delete categories
- **Summary Stats**: Total budgeted, spent, and available

### Insights View
- **Savings Rate**: Track your savings percentage
- **Daily Average**: Average daily spending
- **Biggest Expense**: Largest single expense
- **Top Categories**: Top 5 spending categories with rank bars
- **Monthly Trend**: 6-month spending trend sparkline

## 🎨 Design

**Neo-Brutalist Aesthetic**
- Bold borders and shadows
- High contrast color palette
- Grid paper background
- Custom animations and transitions

**Color Palette**
- Paper: `#f2f5ed` (background)
- Pine: `#0d211a` (primary dark)
- Mint: `#a9dfbc` (accent)
- Moss: `#2f7e58` (success)
- Coral: `#cf4f36` (expense/warning)
- Amber: `#d3961f` (caution)

**Typography**
- Display: Space Grotesk
- Body: IBM Plex Sans
- Mono: Spline Sans Mono

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account (for cloud sync)

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Local Development

The app works immediately with local storage. No cloud setup required to start.

1. Run `npm run dev`
2. Open http://localhost:5173
3. Start adding transactions!

### Cloud Sync Setup

1. **Create Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Create new project (Hobby plan is free)

2. **Run Database Schema**
   - Open Cloud modal in the app
   - Click "Copy SQL"
   - Paste into Supabase SQL Editor
   - Click "Run"

3. **Get Credentials**
   - Go to Project Settings → API
   - Copy Project URL and Publishable Key (starts with `sb_publishable_`)

4. **Connect in App**
   - Click cloud icon in sidebar
   - Paste URL and key
   - Create account (any email/password)
   - Sign in on other devices with same credentials

### Google Sheets Integration

#### Option A: Live Pull (Recommended)

1. **Share Sheet**
   - Open your Google Sheet
   - Click Share → "Anyone with the link" → Viewer

2. **Configure in App**
   - Open Cloud modal
   - Scroll to "Live Google Sheet sync"
   - Paste spreadsheet URL
   - Enter tab name (e.g., "September 2026")
   - Check "Pull on every sync"
   - Click "Save sheet sync"

3. **Monthly Workflow**
   - Each month, update the tab name in Cloud settings
   - Sprout will pull new entries on next sync

#### Option B: Apps Script Push

1. **Open Apps Script**
   - In your Google Sheet: Extensions → Apps Script

2. **Paste Script**
```javascript
const SUPABASE_URL = "https://YOURPROJECT.supabase.co";
const ANON_KEY = "sb_publishable_XXXXXXXX";

function syncToSprout(e) {
  const row = e.range.getRow();
  if (row < 2) return;
  const sheet = e.source.getActiveSheet();
  const [date, kind, category, note, amount, payment] = 
    sheet.getRange(row, 1, 1, 6).getValues()[0];
  if (!date || !amount) return;
  
  const sheetName = sheet.getName();
  const sourceRef = `sheet:${sheetName}:row_${row}`;
  
  UrlFetchApp.fetch(SUPABASE_URL + "/rest/v1/sheet_inbox", {
    method: "post",
    contentType: "application/json",
    headers: { apikey: ANON_KEY, Authorization: "Bearer " + ANON_KEY },
    payload: JSON.stringify({
      date: Utilities.formatDate(new Date(date), Session.getScriptTimeZone(), "yyyy-MM-dd"),
      kind: String(kind || "expense"),
      category: String(category || "Uncategorized"),
      note: String(note || ""),
      amount: Math.abs(Number(amount)),
      payment: String(payment || "").toLowerCase() === "cash" ? "cash" : "card",
      source_ref: sourceRef,
    }),
  });
}
```

3. **Add Trigger**
   - Click Triggers (⏰) → Add trigger
   - Function: `syncToSprout`
   - Event source: From spreadsheet
   - Event type: On edit
   - Save and authorize

## 📊 CSV Import

### Supported Formats

**Dates:**
- `2021-03-05`
- `05/03/2021`
- `1-Sep-2026`
- `Mar 5, 2021`
- `5 March 2021`

**Amounts:**
- `1240.50`
- `₹1,234.56`
- `12,34,567.89` (Indian format)
- `1.234,56` (European format)
- `(45.00)` or `-45` (negative)

**Types:**
- `Inflow` / `Outflow`
- `Income` / `Expense`
- `Credit` / `Debit`

**Payment Methods:**
- `Cash`, `UPI`, `GPay`, `Paytm` → Cash
- `Card`, `Credit`, `Debit`, `Amex` → Card

### Import Process

1. Click "Import" in Transactions view
2. Choose source: CSV file, Sheet link, or Paste text
3. Map columns: Date, Amount, Type, Category, Note, Payment
4. Review preview and click "Import"
5. Unknown categories are auto-created
6. Duplicates are skipped

## 🔒 Security & Privacy

- **Row Level Security**: Each user can only access their own data
- **Publishable Key**: Safe to use in browser (no secret keys)
- **Local Storage**: Data also cached locally for offline access
- **No Tracking**: No analytics or third-party services

## 📱 Responsive Design

- **Desktop**: Full sidebar navigation
- **Tablet**: Collapsible sidebar
- **Mobile**: Bottom navigation bar
- **Touch Optimized**: Large tap targets, swipe gestures

## 🛠️ Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS v4** - Styling
- **Supabase** - Backend & auth
- **Custom SVG Charts** - No chart libraries
- **Custom Icons** - No icon libraries

## 📁 Project Structure

```
src/
├── components/
│   ├── Icons.tsx              # Custom SVG icon set
│   ├── ui.tsx                 # Reusable UI components
│   ├── Charts.tsx             # Donut, FlowBars, Sparkline, RankBars
│   ├── layout.tsx             # Sidebar, MobileBar, ToastHost
│   ├── modals.tsx             # Transaction, Category, Confirm modals
│   ├── CloudModal.tsx         # Cloud sync settings
│   ├── ImportModal.tsx        # CSV/Sheet import
│   ├── MonthPicker.tsx        # Month/year picker
│   └── CategoryTransactionsModal.tsx  # Category drill-down
├── views/
│   ├── Overview.tsx           # Main dashboard
│   ├── Transactions.tsx       # Transaction list
│   ├── Budgets.tsx            # Budget management
│   └── Insights.tsx           # Analytics & insights
├── cloud.ts                   # Supabase sync engine
├── importer.ts                # CSV/Sheet parser
├── store.tsx                  # State management
├── types.ts                   # TypeScript types
├── utils.ts                   # Utility functions
├── data.ts                    # Seed data & categories
├── App.tsx                    # Main app component
└── index.css                  # Tailwind theme & styles
```

## 🎯 Key Implementation Details

### Source-Based Deduplication

Each transaction from Google Sheets gets a stable `sourceRef`:
```
sheet:{tabName}:row_{rowNumber}
```

This allows:
- Editing notes/amounts/categories without creating duplicates
- Updating existing transactions when sheet data changes
- Stable identity across syncs

### Cloud-First Sync

- Supabase is the source of truth
- Local changes are tracked in dirty sets
- Only dirty items are pushed to cloud
- Last-write-wins merge strategy
- Tombstones track deletions

### Category Inference

When importing, categories are inferred from notes:
```typescript
const NOTE_RULES = [
  { re: /petrol|diesel|fuel/i, cat: "Transport" },
  { re: /pizza|dinner|lunch/i, cat: "Dining Out" },
  { re: /amazon|flipkart/i, cat: "Shopping" },
  // ... more rules
];
```

## 🐛 Troubleshooting

### "Column payment does not exist"
Run the SQL migration:
```sql
alter table public.transactions add column if not exists payment text;
```

### "Column source_ref does not exist"
Run the SQL migration:
```sql
alter table public.transactions add column if not exists source_ref text;
alter table public.sheet_inbox add column if not exists source_ref text;
create unique index if not exists idx_transactions_source_ref 
  on public.transactions(user_id, source_ref) 
  where source_ref is not null;
```

### Duplicate entries from sheet
- Ensure Apps Script sends `source_ref` field
- Check that sheet rows have unique row numbers
- Verify source_ref format: `sheet:{tabName}:row_{rowNumber}`

### Modal not centered
- Check browser console for errors
- Ensure Tailwind CSS is loading correctly
- Try hard refresh (Ctrl+Shift+R)

## 📝 License

MIT License - feel free to use for personal or commercial projects.

## 🙏 Credits

Built with modern web technologies and a love for beautiful design.

---

**Made with ❤️ for personal finance tracking**
