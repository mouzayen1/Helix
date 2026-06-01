// Web target: sync is a no-op. The web app reads and writes Supabase
// directly via lib/db.web.ts — there's no local store to reconcile.
// This file exists solely so the native sync trigger in
// app/_layout.tsx can `import { syncAll } from '../lib/sync'` without
// the bundler resolving the native-only SQLite paths.

export async function syncAll(): Promise<{
  pulled: number;
  pushed: number;
  errors: string[];
}> {
  return { pulled: 0, pushed: 0, errors: [] };
}
