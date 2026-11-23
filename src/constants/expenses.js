export const EXPENSE_CATEGORIES = [
  { id: "Raw Ingredients", name: "Raw Ingredients", icon: "🌾", type: "COGS" },
  { id: "Packaging & Boxes", name: "Packaging & Boxes", icon: "📦", type: "COGS" },
  { id: "Utilities & Fuel", name: "Utilities & Fuel", icon: "⚡", type: "OpEx" },
  { id: "Staff & Wages", name: "Staff & Wages", icon: "👨‍🍳", type: "OpEx" },
  { id: "Rent & Kitchen Lease", name: "Rent & Kitchen Lease", icon: "🏠", type: "OpEx" },
  { id: "Equipment & Maintenance", name: "Equipment & Maintenance", icon: "🔧", type: "OpEx" },
  { id: "Marketing & Tech", name: "Marketing & Tech", icon: "📢", type: "OpEx" },
  { id: "Miscellaneous", name: "Miscellaneous", icon: "🧾", type: "OpEx" },
];

export const PAYMENT_METHODS = [
  "UPI / GPay",
  "Cash",
  "Bank Transfer",
  "Debit / Credit Card",
  "Cheque",
];

// Pre-packaged bakery sample operational expenses
export const SAMPLE_EXPENSES = [
  {
    id: "sample-exp-1",
    title: "Commercial Bread Flour & Normandy Butter",
    category: "Raw Ingredients",
    amount: 14500,
    expense_date: "2026-11-20",
    payment_method: "Bank Transfer",
    vendor: "Golden Mill Grains Ltd",
    notes: "20 bags organic bread flour, 15kg European unsalted butter",
    created_at: "2026-11-20T10:00:00.000Z",
  },
  {
    id: "sample-exp-2",
    title: "Belgian Dark Chocolate 70% & Vanilla Pods",
    category: "Raw Ingredients",
    amount: 6200,
    expense_date: "2026-11-18",
    payment_method: "UPI / GPay",
    vendor: "Artisan Cocoa Importers",
    notes: "Premium Callebaut callets for chocolate fudge cakes & ganache",
    created_at: "2026-11-18T11:30:00.000Z",
  },
  {
    id: "sample-exp-3",
    title: "Biodegradable Cake Boxes & Pastry Bags",
    category: "Packaging & Boxes",
    amount: 3800,
    expense_date: "2026-11-16",
    payment_method: "UPI / GPay",
    vendor: "GreenPack Bakery Supplies",
    notes: "500 embossed cake boxes with window and greaseproof liners",
    created_at: "2026-11-16T14:15:00.000Z",
  },
  {
    id: "sample-exp-4",
    title: "Commercial Deck Oven Electricity & Power",
    category: "Utilities & Fuel",
    amount: 8900,
    expense_date: "2026-11-14",
    payment_method: "Bank Transfer",
    vendor: "City Electricity Board",
    notes: "Monthly commercial energy tariff for baking decks & walk-in chiller",
    created_at: "2026-11-14T09:00:00.000Z",
  },
  {
    id: "sample-exp-5",
    title: "Head Pastry Chef & Kitchen Assistants Wages",
    category: "Staff & Wages",
    amount: 24000,
    expense_date: "2026-11-11",
    payment_method: "Bank Transfer",
    vendor: "Bakery Kitchen Staff",
    notes: "Bi-weekly payroll for head baker, 2 prep cooks & cleaner",
    created_at: "2026-11-11T17:00:00.000Z",
  },
  {
    id: "sample-exp-6",
    title: "Storefront & Kitchen Commercial Lease",
    category: "Rent & Kitchen Lease",
    amount: 28000,
    expense_date: "2026-11-05",
    payment_method: "Bank Transfer",
    vendor: "Heritage Commercial Properties",
    notes: "Monthly bakery storefront and baking facility lease",
    created_at: "2026-11-05T08:00:00.000Z",
  },
  {
    id: "sample-exp-7",
    title: "Spiral Dough Mixer Service & Belt Tuning",
    category: "Equipment & Maintenance",
    amount: 2400,
    expense_date: "2026-11-08",
    payment_method: "Cash",
    vendor: "KitchenFix Commercial Care",
    notes: "Safety inspection, motor belt tensioning, food-grade greasing",
    created_at: "2026-11-08T15:45:00.000Z",
  },
  {
    id: "sample-exp-8",
    title: "Instagram Ads & Local Weekend Flyer Campaign",
    category: "Marketing & Tech",
    amount: 1950,
    expense_date: "2026-11-19",
    payment_method: "Debit / Credit Card",
    vendor: "Meta Advertising & Local Print",
    notes: "Promoting fresh sourdough delivery and weekend tea cakes",
    created_at: "2026-11-19T12:00:00.000Z",
  },
];

export const SUPABASE_SQL_HELPER = `-- Run this in your Supabase SQL Editor:
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    amount NUMERIC NOT NULL CHECK (amount >= 0),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method TEXT DEFAULT 'UPI / GPay',
    vendor TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to expenses"
ON public.expenses FOR SELECT USING (true);

CREATE POLICY "Allow full access to expenses"
ON public.expenses FOR ALL USING (true);`;

export function generateExpenseId() {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 7);
  return `exp-${timestamp}-${randomPart}`;
}

export function getTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
