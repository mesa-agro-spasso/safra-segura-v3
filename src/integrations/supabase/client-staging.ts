import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const STAGING_URL = "https://bocsovenbertyepsiobp.supabase.co";
const STAGING_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvY3NvdmVuYmVydHllcHNpb2JwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMzM5MzMsImV4cCI6MjA5MzcwOTkzM30.1babVqYKQqSjgL5-EC_bv0_Fz3Hoo2zjfP65L3Xplco";

export const supabaseStaging = createClient<Database>(STAGING_URL, STAGING_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
