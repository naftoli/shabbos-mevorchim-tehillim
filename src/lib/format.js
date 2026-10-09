// Small display helpers shared across the app.

export const fmt = (n) => (n == null ? '—' : Math.round(n).toLocaleString('en-US'))

export const pctText = (n) => `${Math.round(n)}%`
