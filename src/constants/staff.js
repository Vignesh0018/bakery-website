export const STAFF_ROLES = [
  {
    id: "Admin",
    title: "Bakery Owner / Admin",
    badgeColor: "#432719",
    bgColor: "#fdf8f3",
    description: "Full administrative access to kitchen, financials, staff, and customer orders.",
    defaultPermissions: [
      "manage_products",
      "manage_orders",
      "manage_inventory",
      "manage_staff",
      "view_finances",
      "manage_customers",
    ],
  },
  {
    id: "Head Baker",
    title: "Head Baker / Kitchen Lead",
    badgeColor: "#b76e27",
    bgColor: "#fff7ed",
    description: "Leads sourdough and bread production, recipe formulation, and kitchen stock.",
    defaultPermissions: [
      "manage_products",
      "manage_orders",
      "manage_inventory",
    ],
  },
  {
    id: "Pastry Chef",
    title: "Senior Pastry Chef",
    badgeColor: "#ad1457",
    bgColor: "#fdf2f8",
    description: "Specializes in celebration cakes, French pastries, chocolate, and desserts.",
    defaultPermissions: [
      "manage_products",
      "manage_orders",
      "manage_inventory",
    ],
  },
  {
    id: "Cashier",
    title: "Front Desk & Cashier",
    badgeColor: "#1565c0",
    bgColor: "#eff6ff",
    description: "Manages customer counter, point-of-sale checkout, customer orders, and queries.",
    defaultPermissions: [
      "manage_orders",
      "manage_customers",
    ],
  },
  {
    id: "Kitchen Assistant",
    title: "Kitchen & Prep Assistant",
    badgeColor: "#2e7d32",
    bgColor: "#f0fdf4",
    description: "Assists with ingredient prep, oven staging, packaging, and stock receipt.",
    defaultPermissions: [
      "manage_inventory",
    ],
  },
  {
    id: "Delivery Lead",
    title: "Delivery & Dispatch Lead",
    badgeColor: "#6a1b9a",
    bgColor: "#faf5ff",
    description: "Handles packaging fulfillment, customer delivery dispatch, and delivery updates.",
    defaultPermissions: [
      "manage_orders",
    ],
  },
];

export const PERMISSIONS_LIST = [
  { id: "manage_products", label: "Menu & Products", desc: "Create, edit pricing & toggle availability" },
  { id: "manage_orders", label: "Order Management", desc: "Confirm, update status, and manage kitchen tickets" },
  { id: "manage_inventory", label: "Inventory & Stock", desc: "Log flour/dairy batches, adjust quantities & reorder levels" },
  { id: "manage_staff", label: "Staff & Permissions", desc: "Add staff accounts, assign shifts & manage permissions" },
  { id: "view_finances", label: "Finances & P&L", desc: "Access expense ledger, revenue metrics & profit reports" },
  { id: "manage_customers", label: "Customer CRM", desc: "View customer profiles, contact info & order records" },
];

export const SHIFT_SCHEDULES = [
  "Early Morning Bake (4:00 AM - 12:00 PM)",
  "Morning Shift (7:00 AM - 3:00 PM)",
  "General Shift (9:00 AM - 5:00 PM)",
  "Afternoon / Evening (1:00 PM - 9:00 PM)",
  "Night Prep Shift (10:00 PM - 6:00 AM)",
];

export const SAMPLE_STAFF = [
  {
    id: "staff-1",
    full_name: "Priya Nair",
    email: "priya.nair@thegoldencrust.com",
    phone: "+91 98201 11223",
    role: "Admin",
    status: "Active",
    shift: "General Shift (9:00 AM - 5:00 PM)",
    join_date: "2025-03-15",
    permissions: [
      "manage_products",
      "manage_orders",
      "manage_inventory",
      "manage_staff",
      "view_finances",
      "manage_customers",
    ],
    notes: "General Manager & Co-Owner overseeing daily operations.",
    created_at: "2025-03-15T09:00:00.000Z",
  },
  {
    id: "staff-2",
    full_name: "Pierre Dubois",
    email: "pierre.dubois@thegoldencrust.com",
    phone: "+91 98450 33445",
    role: "Head Baker",
    status: "Active",
    shift: "Early Morning Bake (4:00 AM - 12:00 PM)",
    join_date: "2025-04-01",
    permissions: ["manage_products", "manage_orders", "manage_inventory"],
    notes: "Master artisanal baker from Lyon. Oversees sourdough fermentation.",
    created_at: "2025-04-01T08:00:00.000Z",
  },
  {
    id: "staff-3",
    full_name: "Ananya Sharma",
    email: "ananya.sharma@thegoldencrust.com",
    phone: "+91 97110 55667",
    role: "Pastry Chef",
    status: "Active",
    shift: "Morning Shift (7:00 AM - 3:00 PM)",
    join_date: "2025-05-10",
    permissions: ["manage_products", "manage_orders", "manage_inventory"],
    notes: "Specialized in Belgian chocolate entremets & multi-tier celebration cakes.",
    created_at: "2025-05-10T10:00:00.000Z",
  },
  {
    id: "staff-4",
    full_name: "Rahul Verma",
    email: "rahul.verma@thegoldencrust.com",
    phone: "+91 98765 77889",
    role: "Cashier",
    status: "Active",
    shift: "Morning Shift (7:00 AM - 3:00 PM)",
    join_date: "2025-06-01",
    permissions: ["manage_orders", "manage_customers"],
    notes: "Customer service champion and counter POS lead.",
    created_at: "2025-06-01T11:00:00.000Z",
  },
  {
    id: "staff-5",
    full_name: "Vikram Singh",
    email: "vikram.singh@thegoldencrust.com",
    phone: "+91 99234 88990",
    role: "Delivery Lead",
    status: "Active",
    shift: "Afternoon / Evening (1:00 PM - 9:00 PM)",
    join_date: "2025-07-15",
    permissions: ["manage_orders"],
    notes: "Dispatches packaging and coordinates neighborhood doorstep deliveries.",
    created_at: "2025-07-15T12:00:00.000Z",
  },
];

export const SUPABASE_STAFF_SQL_HELPER = `-- Run this in your Supabase SQL Editor:
CREATE TABLE IF NOT EXISTS public.staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'Kitchen Assistant',
    status TEXT NOT NULL DEFAULT 'Active',
    shift TEXT DEFAULT 'General Shift (9:00 AM - 5:00 PM)',
    join_date DATE DEFAULT CURRENT_DATE,
    permissions JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to staff"
ON public.staff FOR SELECT USING (true);

CREATE POLICY "Allow full access to staff"
ON public.staff FOR ALL USING (true);`;

export function generateStaffId() {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 7);
  return `staff-${timestamp}-${randomPart}`;
}
