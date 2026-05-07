// Shared "Xh ago / Yd ago / Zw ago" formatter so list rows, sheet
// rows, and any future UI all render the same relative-time string.
//
// The Injection Sites list previously rendered `${days_since}d ago`
// with `days_since = floor(ms / 864e5)`, which produced "0d ago" for
// any dose under 24h old — ambiguous and looks like a render bug.
// This helper switches to hours under 24h and to weeks past 14 days
// so the unit always communicates something meaningful.

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

/**
 * Format an ISO timestamp (or a parseable date string) as a short
 * relative-time label like "just now" / "3h ago" / "2d ago" / "5w ago".
 *
 * Pass `neverLabel` for the "user has no entries yet" case — when
 * `taken_at` is null/empty, this label is returned instead of throwing
 * or producing nonsense ("NaNd ago"). The default is an em-dash so
 * "—" still works as the visual placeholder we used before.
 */
export function formatRelativeAge(
  taken_at: string | null | undefined,
  neverLabel = '—',
): string {
  if (!taken_at) return neverLabel;
  const t = new Date(taken_at).getTime();
  if (!Number.isFinite(t)) return neverLabel;

  const ms = Date.now() - t;
  if (ms < 0) return 'just now';
  if (ms < HOUR_MS) {
    const m = Math.floor(ms / 60_000);
    return m <= 0 ? 'just now' : `${m}m ago`;
  }
  if (ms < DAY_MS) {
    return `${Math.floor(ms / HOUR_MS)}h ago`;
  }
  if (ms < 2 * DAY_MS) return 'yesterday';
  if (ms < 14 * DAY_MS) return `${Math.floor(ms / DAY_MS)}d ago`;
  return `${Math.floor(ms / WEEK_MS)}w ago`;
}
