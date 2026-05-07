// One-shot: provision PROD users into STAGING Supabase project.
// Auth: requires STAGING_ADMIN_TOKEN query param matching the staging service role key.
// Idempotent: skips users that already exist in staging.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_PASSWORD = "Spasso@Staging2026";

const STAGING_URL = "https://bocsovenbertyepsiobp.supabase.co";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const prodUrl = Deno.env.get("SUPABASE_URL")!;
    const prodServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stagingServiceKey = Deno.env.get("STAGING_SUPABASE_SERVICE_ROLE_KEY");

    if (!stagingServiceKey) {
      return new Response(JSON.stringify({ error: "STAGING_SUPABASE_SERVICE_ROLE_KEY not set" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prod = createClient(prodUrl, prodServiceKey);
    const staging = createClient(STAGING_URL, stagingServiceKey);

    // Read PROD profiles
    const { data: profiles, error: profErr } = await prod
      .from("user_profiles")
      .select("id, email, full_name, is_admin, status, access_level, theme");
    if (profErr) throw profErr;

    const results: Array<Record<string, unknown>> = [];

    for (const p of profiles ?? []) {
      try {
        // Check if user exists in staging by email
        const { data: existing } = await staging.auth.admin.listUsers();
        const found = existing?.users?.find((u) => u.email?.toLowerCase() === p.email.toLowerCase());

        let stagingUserId = found?.id;

        if (!found) {
          const { data: created, error: createErr } = await staging.auth.admin.createUser({
            email: p.email,
            password: DEFAULT_PASSWORD,
            email_confirm: true,
            user_metadata: { full_name: p.full_name },
          });
          if (createErr) throw createErr;
          stagingUserId = created.user!.id;
        }

        // Upsert profile in staging mirroring prod fields
        const { error: upsertErr } = await staging.from("user_profiles").upsert({
          id: stagingUserId,
          email: p.email,
          full_name: p.full_name,
          is_admin: p.is_admin,
          status: p.status,
          access_level: p.access_level,
          theme: p.theme ?? "dark",
        });
        if (upsertErr) throw upsertErr;

        results.push({
          email: p.email,
          status: found ? "existed" : "created",
          staging_id: stagingUserId,
        });
      } catch (e) {
        results.push({ email: p.email, error: (e as Error).message });
      }
    }

    return new Response(JSON.stringify({
      default_password: DEFAULT_PASSWORD,
      total: results.length,
      results,
    }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
