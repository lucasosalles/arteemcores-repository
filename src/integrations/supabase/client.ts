import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const PROJECT_REF = 'nwrpcxmkcjvpemgtdmfd';

/**
 * Removes ALL Supabase storage keys for this project from localStorage and
 * sessionStorage. Must run BEFORE createClient so the SDK never reads a
 * corrupted token on initialization.
 */
export const purgeSupabaseStorage = () => {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(`sb-${PROJECT_REF}`)) localStorage.removeItem(key);
    }
  } catch {}
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(`sb-${PROJECT_REF}`)) sessionStorage.removeItem(key);
    }
  } catch {}
};

// ── Pre-flight: validate stored auth token before the SDK reads it ──────────
// The SDK calls localStorage.getItem during createClient; if the token is
// corrupt (bad JSON, missing access_token) it will attempt a refresh that
// fails with session_timeout. Purge first to prevent that.
try {
  const raw = localStorage.getItem(`sb-${PROJECT_REF}-auth-token`);
  if (raw !== null) {
    const parsed = JSON.parse(raw);
    if (!parsed?.access_token || !parsed?.refresh_token) {
      purgeSupabaseStorage();
    }
  }
} catch {
  // JSON.parse failed — entry is corrupted
  purgeSupabaseStorage();
}
// ────────────────────────────────────────────────────────────────────────────

const fetchWithTimeout = (url: RequestInfo | URL, options?: RequestInit) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
};

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    fetch: fetchWithTimeout,
  },
});