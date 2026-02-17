import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabase: SupabaseClient;

const initSupabase = (url: string, anonKey: string) => {
  if (supabase) return;

  supabase = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true
    }
  });
};

// Try to init from build-time env vars (fallback for dev)
const buildTimeUrl = import.meta.env.VITE_SUPABASE_URL as string;
const buildTimeKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (buildTimeUrl && buildTimeKey) {
  initSupabase(buildTimeUrl, buildTimeKey);
}

const getAccessToken = async (): Promise<string | null> => {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
};

export { getAccessToken, initSupabase, supabase };
