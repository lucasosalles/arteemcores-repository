import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const PROJECT_REF = 'nwrpcxmkcjvpemgtdmfd';

const AUTH_KEY = `sb-${PROJECT_REF}-auth-token`;

/**
 * Removes ALL Supabase storage keys for this project.
 * Targets sessionStorage (current auth storage) then sweeps localStorage
 * for backward compat with tokens written before this change.
 * Must be callable before and after createClient.
 */
export const purgeSupabaseStorage = () => {
  // Primary: sessionStorage (current auth storage — isolated per tab)
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(`sb-${PROJECT_REF}`)) sessionStorage.removeItem(key);
    }
  } catch {}
  // Backward compat: also clear any old tokens that may still be in localStorage
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(`sb-${PROJECT_REF}`)) localStorage.removeItem(key);
    }
  } catch {}
};

// ── Pre-flight: validate stored auth token before the SDK reads it ──────────
// The SDK reads sessionStorage during createClient. If the token is corrupt
// (bad JSON, missing fields) it will attempt a network refresh that fails
// with session_timeout. Purge first so the SDK starts with an empty store.
try {
  const raw = sessionStorage.getItem(AUTH_KEY);
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
    storage: sessionStorage,   // isolated per tab — no cross-tab session conflicts
    storageKey: AUTH_KEY,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    fetch: fetchWithTimeout,
  },
});