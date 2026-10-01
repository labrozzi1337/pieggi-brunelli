import { createClient } from "@supabase/supabase-js";
import type { ServerEnv } from "@/config/env";

const DATABASE_SCHEMA = "start_back";

export function createServerSupabaseClient(env: ServerEnv) {
  return createClient(env.START_BACK_SUPABASE_URL, env.START_BACK_SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    db: { schema: DATABASE_SCHEMA }
  });
}

export type ServerSupabaseClient = ReturnType<typeof createServerSupabaseClient>;

