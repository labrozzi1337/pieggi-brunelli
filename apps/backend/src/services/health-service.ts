import type { ServerSupabaseClient } from "@/integrations/supabase/server";

export type DatabaseStatus = "connected" | "unavailable";

export async function checkDatabase(client: ServerSupabaseClient): Promise<DatabaseStatus> {
  try {
    const { error } = await client.from("app_metadata").select("key", { head: true, count: "exact" });
    return error ? "unavailable" : "connected";
  } catch {
    return "unavailable";
  }
}

