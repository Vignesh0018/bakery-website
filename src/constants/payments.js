// Payment Methods
export const PAYMENT_METHODS = [
  { id: "Cash", label: "Cash", icon: "💵", color: "#2e7d32" },
  { id: "UPI / QR", label: "UPI / QR", icon: "📱", color: "#1565c0" },
  { id: "Card", label: "Card", icon: "💳", color: "#6a1b9a" },
  { id: "Bank Transfer", label: "Bank Transfer", icon: "🏦", color: "#00838f" },
];

// Payment Statuses
export const PAYMENT_STATUSES = [
  { id: "Paid", label: "Paid", icon: "✓", badgeClass: "paid", color: "#2e7d32" },
  { id: "Pending", label: "Pending", icon: "⏳", badgeClass: "pending", color: "#e65100" },
  { id: "Partial", label: "Partial Advance", icon: "⚠️", badgeClass: "partial", color: "#f57f17" },
  { id: "Refunded", label: "Refunded", icon: "🔄", badgeClass: "refunded", color: "#c62828" },
];

// Payment Purposes / Categories
export const PAYMENT_CATEGORIES = [
  "Counter Sale (POS Bill)",
  "Custom Cake Order",
  "Party / Event Catering Advance",
  "Khata / Credit Settlement",
  "Gift Voucher / Token",
  "Miscellaneous Payment",
];

// Helper to generate unique transaction ID
export function generateTransactionId() {
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `TXN-${dateStr}-${randomSuffix}`;
}

// Format currency
export function formatINR(amount) {
  const num = Number(amount) || 0;
  return `₹${num.toLocaleString("en-IN")}`;
}

// Get today's ISO date string (YYYY-MM-DD)
export function getTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
