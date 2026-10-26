// Per-tab identity until auth exists (out of scope for v1).
const COLORS = ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#0891b2'];

export const me = {
  name: `Guest ${Math.floor(Math.random() * 1000)}`,
  color: COLORS[Math.floor(Math.random() * COLORS.length)],
};
