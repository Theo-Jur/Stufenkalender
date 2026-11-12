// Muss VOR supabase.js geladen werden.
// Enthält die Adresse eine Fehlermeldung aus einem E-Mail-Link (z. B. abgelaufen oder schon benutzt),
// merken wir sie uns und entfernen sie aus der Adresse. Sonst würde Supabase sie bei jedem Laden erneut auswerten.
const params = new URLSearchParams((location.hash || '').replace(/^#/, '') + '&' + (location.search || '').replace(/^\?/, ''));
const code = params.get('error_code') || params.get('error');
export const linkError = code
  ? { code, description: params.get('error_description') || '' }
  : null;
if (linkError) history.replaceState(null, '', location.pathname);
