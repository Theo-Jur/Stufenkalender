import { createClient } from '@supabase/supabase-js';

// Die beiden Werte kommen aus der Datei .env (lokal) bzw. aus den Umgebungsvariablen beim Hosting.
// Der "anon"-Schlüssel ist für den Browser gedacht und darf öffentlich sein.
// Den "service_role"-Schlüssel niemals hier eintragen.
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const configured = Boolean(url && key);

export const supabase = configured
  ? createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null;
