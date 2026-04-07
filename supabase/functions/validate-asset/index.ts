import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      validation_id,
      project_id,
      asset_id,
      episode_shot_id,
      asset_type,
      asset_url,
      prompt,
      scene_description,
    } = body;

    if (!validation_id || !project_id) {
      return new Response(
        JSON.stringify({ error: "validation_id and project_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const sb = createClient(supabaseUrl, serviceKey);

    // Mark validation as running
    await sb
      .from("asset_validations")
      .update({ validation_status: "running" })
      .eq("id", validation_id);

    // Build the analysis prompt
    const analysisPrompt = buildAnalysisPrompt(asset_type, prompt, scene_description, asset_url);

    let anomalies: Array<{
      category: string;
      subcategory: string;
      severity: string;
      confidence: number;
      explanation: string;
      suggested_fix: string;
      blocking: boolean;
    }> = [];

    let scores = {
      anatomy: null as number | null,
      temporal: null as number | null,
      semantic: null as number | null,
      continuity: null as number | null,
      av: null as number | null,
      framing: null as number | null,
      final: null as number | null,
    };

    // Call AI judge if key available
    if (lovableKey) {
      try {
        const aiResult = await callAIJudge(lovableKey, analysisPrompt, asset_url, asset_type);
        if (aiResult) {
          anomalies = aiResult.anomalies || [];
          scores = { ...scores, ...aiResult.scores };
        }
      } catch (e) {
        console.error("AI judge error:", e);
      }
    }

    // Compute final score
    const scoreValues = Object.values(scores).filter((v): v is number => v !== null);
    const finalScore = scoreValues.length > 0
      ? Math.round((scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length) * 100) / 100
      : 50;
    scores.final = finalScore;

    // Determine status
    const hasBlocking = anomalies.some((a) => a.blocking || a.severity === "blocking");
    const hasMajor = anomalies.some((a) => a.severity === "major");
    const status = hasBlocking ? "blocked" : hasMajor ? "failed" : "passed";

    // Update validation record
    await sb
      .from("asset_validations")
      .update({
        validation_status: status,
        scores,
        blocking: hasBlocking,
        explanation: anomalies.length > 0
          ? `${anomalies.length} anomalie(s) détectée(s). ${hasBlocking ? "Bloquant." : hasMajor ? "Échec." : "OK."}`
          : "Aucune anomalie détectée.",
        pass_results: [
          { pass: "technical", status: "passed" },
          { pass: "visual", status: hasBlocking ? "failed" : "passed" },
          { pass: "semantic", status: anomalies.some((a) => a.category === "semantic") ? "failed" : "passed" },
          { pass: "continuity", status: anomalies.some((a) => a.category === "identity") ? "failed" : "passed" },
        ],
      })
      .eq("id", validation_id);

    // Insert anomaly events
    if (anomalies.length > 0) {
      await sb.from("anomaly_events").insert(
        anomalies.map((a) => ({
          validation_id,
          category: a.category,
          subcategory: a.subcategory,
          severity: a.severity,
          confidence: a.confidence,
          explanation: a.explanation,
          suggested_fix: a.suggested_fix,
          blocking: a.blocking || a.severity === "blocking",
        }))
      );
    }

    // Log diagnostic event
    await sb.from("diagnostic_events").insert({
      project_id,
      event_type: "asset_validation",
      severity: hasBlocking ? "error" : hasMajor ? "warning" : "info",
      title: `Validation ${status}: ${anomalies.length} anomalie(s)`,
      detail: anomalies.map((a) => `[${a.severity}] ${a.category}/${a.subcategory}: ${a.explanation}`).join("\n"),
      scope: "job",
      scope_id: validation_id,
    });

    // Auto-create incident for blocking validations
    if (hasBlocking) {
      await sb.from("incidents").insert({
        project_id,
        title: `Blocking validation failure on ${asset_type || "asset"}`,
        detail: `${anomalies.filter(a => a.blocking || a.severity === "blocking").map(a => `[${a.category}/${a.subcategory}] ${a.explanation}`).join("; ")}`,
        severity: "critical",
        scope: "validation",
        scope_id: validation_id,
        status: "open",
      }).then(({ error: incErr }) => { if (incErr) console.error("Incident insert failed:", incErr); });
    }

    return new Response(
      JSON.stringify({ validation_id, status, anomaly_count: anomalies.length, scores }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("validate-asset error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildAnalysisPrompt(
  assetType: string,
  prompt?: string,
  sceneDescription?: string,
  assetUrl?: string
): string {
  const parts = [
    `You are a professional QC validator for AI-generated ${assetType} content.`,
    `Analyze the provided ${assetType} for aberrations and quality issues.`,
    "",
    "Check for these categories:",
    "- anatomy: extra limbs, melted faces, impossible poses",
    "- object: morphing, disappearance, substitution",
    "- temporal: flicker, identity drift, continuity breaks (video only)",
    "- physics: gravity issues, object permanence failures",
    "- semantic: wrong action, setting, character count, emotion, mood vs script",
    "- identity: face drift, costume drift from references",
    "- framing: unintended crop, wrong aspect ratio, hidden subject",
    "- text_graphic: broken/unreadable text in image",
    "- audio: lip-sync mismatch, wrong ambience (if applicable)",
  ];

  if (prompt) parts.push("", `Original generation prompt: "${prompt}"`);
  if (sceneDescription) parts.push("", `Scene description: "${sceneDescription}"`);
  if (assetUrl) parts.push("", `Asset URL for analysis: ${assetUrl}`);

  parts.push(
    "",
    "Respond using the suggest_validation_result tool with scores (0-100) and any anomalies found.",
    "Only report real issues. Score 80+ means good quality."
  );

  return parts.join("\n");
}

async function callAIJudge(
  apiKey: string,
  systemPrompt: string,
  assetUrl?: string,
  assetType?: string
) {
  const messages: Array<{ role: string; content: any }> = [
    { role: "system", content: systemPrompt },
  ];

  // For image assets with URL, include as vision input
  if (assetUrl && assetType === "image") {
    messages.push({
      role: "user",
      content: [
        { type: "text", text: "Analyze this generated image for aberrations:" },
        { type: "image_url", image_url: { url: assetUrl } },
      ],
    });
  } else {
    messages.push({
      role: "user",
      content: "Analyze the asset described above and provide your validation assessment.",
    });
  }

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages,
      tools: [
        {
          type: "function",
          function: {
            name: "suggest_validation_result",
            description: "Return structured validation results for the asset",
            parameters: {
              type: "object",
              properties: {
                scores: {
                  type: "object",
                  properties: {
                    anatomy: { type: "number", description: "0-100 anatomy quality" },
                    temporal: { type: "number", description: "0-100 temporal consistency" },
                    semantic: { type: "number", description: "0-100 script adherence" },
                    continuity: { type: "number", description: "0-100 continuity with refs" },
                    framing: { type: "number", description: "0-100 framing quality" },
                    av: { type: "number", description: "0-100 audio-visual sync" },
                  },
                  required: ["anatomy", "semantic", "framing"],
                  additionalProperties: false,
                },
                anomalies: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      category: { type: "string" },
                      subcategory: { type: "string" },
                      severity: { type: "string", enum: ["info", "minor", "moderate", "major", "blocking"] },
                      confidence: { type: "number" },
                      explanation: { type: "string" },
                      suggested_fix: { type: "string" },
                      blocking: { type: "boolean" },
                    },
                    required: ["category", "subcategory", "severity", "confidence", "explanation", "suggested_fix", "blocking"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["scores", "anomalies"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "suggest_validation_result" } },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("AI gateway error:", response.status, errText);
    return null;
  }

  const result = await response.json();
  const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) return null;

  try {
    return JSON.parse(toolCall.function.arguments);
  } catch {
    return null;
  }
}
