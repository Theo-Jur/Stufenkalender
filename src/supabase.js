import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

// Die Werte stehen in src/config.js. Zum Testen mit einem anderen Projekt
// können sie über VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY (Datei .env) überschrieben werden.
const url = (import.meta.env.VITE_SUPABASE_OVERRIDE === 'true' && import.meta.env.VITE_SUPABASE_URL) || SUPABASE_URL;
const key = (import.meta.env.VITE_SUPABASE_OVERRIDE === 'true' && import.meta.env.VITE_SUPABASE_ANON_KEY) || SUPABASE_KEY;

export const configured = Boolean(url && key);

export const supabase = configured
  ? createClient(url.trim().replace(/\/+$/, ''), key.trim(), {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null;
