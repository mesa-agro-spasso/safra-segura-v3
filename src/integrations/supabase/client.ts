// Cliente Supabase único, apontando para o schema `public`.
//
// O schema `staging` foi depreciado: não existe mais alternância de ambiente
// no frontend. `supabasePublic` é mantido como alias do mesmo client porque
// AuthContext e activityLog o importam explicitamente para deixar claro que
// aquelas leituras/escritas sempre vão para `public`.
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://ngwhatepvofvwgzbudth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nd2hhdGVwdm9mdndnemJ1ZHRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNDA2NzgsImV4cCI6MjA5MDYxNjY3OH0.t6_qd3X3_DyNWlkHg2Yp26GHQu2EiQgKk8_x7hBXz_o";

export const supabase: SupabaseClient<Database> = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  },
);

export const supabasePublic: SupabaseClient<Database> = supabase;
