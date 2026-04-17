// Reprocess legacy documents in controlled batches.
// Estimates cost first if dry_run=true, otherwise reprocesses up to `limit` docs.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const COST_PER_DOC_CREDITS = 1; // rough estimate based on average gemini call
const MAX_BATCH = 5;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const authHeader = req.headers.get("Authorization") ?? "";
  const { data: userData } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (!userData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = userData.user.id;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch { /* empty body OK */ }

  const projectId = (body.project_id as string | undefined) ?? null;
  const dryRun = body.dry_run === true;
  const limit = Math.min(MAX_BATCH, Math.max(1, Number(body.limit) || MAX_BATCH));

  // Fetch eligible legacy documents owned by the user (or all if admin + no project filter)
  let query = supabase
    .from("source_documents")
    .select("id, file_name, file_size_bytes, project_id")
    .or("parser_version.is.null,parser_version.eq.legacy")
    .neq("status", "parsing_failed")
    .limit(100);

  if (projectId) {
    query = query.eq("project_id", projectId);
  } else {
    query = query.eq("uploaded_by", userId);
  }

  const { data: docs, error } = await query;
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const total = docs?.length ?? 0;
  const estimatedCredits = total * COST_PER_DOC_CREDITS;

  if (dryRun) {
    return new Response(
      JSON.stringify({
        dry_run: true,
        total_legacy: total,
        estimated_credits: estimatedCredits,
        sample: docs?.slice(0, 5).map((d) => d.file_name) ?? [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Process up to `limit` docs by invoking import-document?action=reprocess
  const toProcess = docs?.slice(0, limit) ?? [];
  const results: Array<{ id: string; ok: boolean; error?: string }> = [];

  for (const doc of toProcess) {
    try {
      const res = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/import-document`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": authHeader,
          },
          body: JSON.stringify({ action: "reprocess", document_id: doc.id }),
        },
      );
      const data = await res.json();
      results.push({ id: doc.id, ok: res.ok, error: res.ok ? undefined : data.error });
    } catch (e) {
      results.push({
        id: doc.id,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return new Response(
    JSON.stringify({
      processed: results.length,
      total_legacy_remaining: total - results.filter((r) => r.ok).length,
      results,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
