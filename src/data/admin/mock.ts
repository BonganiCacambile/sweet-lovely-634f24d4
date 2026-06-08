export type Kpi = {
  key: string;
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  delta: number;
  spark: number[];
};

export const KPIS: Kpi[] = [
  { key: "users", label: "Total members", value: 12480, delta: 8.4, spark: [12,18,16,22,28,26,32,38,36,44,52,58] },
  { key: "active", label: "Active today", value: 3142, delta: 3.1, spark: [20,22,21,26,28,30,32,34,33,36,38,42] },
  { key: "revenue", label: "Revenue (30d)", value: 184320, prefix: "R", delta: 12.6, spark: [60,72,68,80,92,88,104,110,118,126,138,152] },
  { key: "orders", label: "Orders", value: 5872, delta: 5.2, spark: [30,34,32,38,40,44,48,50,52,58,62,66] },
  { key: "conv", label: "Conversion", value: 4.8, suffix: "%", delta: 0.6, spark: [3.2,3.4,3.6,3.5,4.0,4.1,4.3,4.4,4.5,4.6,4.7,4.8] },
  { key: "growth", label: "Growth (MoM)", value: 14.2, suffix: "%", delta: 2.1, spark: [6,7,8,9,10,11,12,12,13,13,14,14.2] },
];

export const REVENUE = Array.from({ length: 30 }, (_, i) => ({
  day: `D${i + 1}`,
  revenue: Math.round(3000 + Math.sin(i / 3) * 800 + i * 180 + Math.random() * 500),
  orders: Math.round(40 + Math.sin(i / 4) * 10 + i * 1.6 + Math.random() * 8),
}));

export const RECENT_ORDERS = [
  { id: "SL-10293", customer: "Aluwani M.", total: 384, status: "Delivered", at: "2m ago" },
  { id: "SL-10292", customer: "Themba K.", total: 219, status: "Out for delivery", at: "11m ago" },
  { id: "SL-10291", customer: "Naledi P.", total: 612, status: "Preparing", at: "24m ago" },
  { id: "SL-10290", customer: "Sipho D.", total: 158, status: "Delivered", at: "1h ago" },
  { id: "SL-10289", customer: "Lerato N.", total: 472, status: "Cancelled", at: "2h ago" },
  { id: "SL-10288", customer: "Kabelo R.", total: 295, status: "Delivered", at: "3h ago" },
];

export const RECENT_SIGNUPS = [
  { name: "Zinhle V.", email: "z.v@example.com", at: "Just now" },
  { name: "Bonga T.", email: "b.t@example.com", at: "12m ago" },
  { name: "Mpho L.", email: "m.l@example.com", at: "38m ago" },
  { name: "Anele S.", email: "a.s@example.com", at: "1h ago" },
  { name: "Riaan B.", email: "r.b@example.com", at: "2h ago" },
];