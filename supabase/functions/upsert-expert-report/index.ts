// Idempotent upsert endpoint for expert_reports.
// Always upserts by appointment_id when provided. Returns consistent
// client-friendly status codes:
//   201 - inserted (new row)
//   200 - updated (existing row matched by appointment_id)
//   400 - validation error
//   401 - unauthorized (missing/invalid JWT)
//   500 - unexpected server error
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({
  appointment_id: z.string().uuid().nullable().optional(),
  expert_id: z.string().uuid({ message: "Valid expert is required" }),
  claimant_id: z.string().uuid({ message: "Valid claimant is required" }),
  report_status: z.string().trim().min(1).max(100).optional(),
  report_submitted_date: z.string().optional().nullable(),
  payment_status: z.string().trim().max(50).optional(),
  payment_date: z.string().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

type Body = z.infer<typeof BodySchema>;

type ResponseBody = {
  ok: boolean;
  action: "inserted" | "updated";
  id: string;
  appointment_id: string | null;
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  // Auth: validate JWT in code (verify_jwt=false default)
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return json(401, { ok: false, error: "Missing bearer token" });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  // User-scoped client to verify identity
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userRes, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userRes?.user) {
    return json(401, { ok: false, error: "Invalid or expired token" });
  }

  // Parse + validate body
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json(400, { ok: false, error: "Invalid JSON body" });
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return json(400, {
      ok: false,
      error: "Validation failed",
      details: parsed.error.flatten().fieldErrors,
    });
  }
  const body: Body = parsed.data;

  // Service-role client to bypass RLS for the controlled upsert path
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // Idempotent upsert by appointment_id (when present)
    if (body.appointment_id) {
      const { data: existing, error: lookupErr } = await admin
        .from("expert_reports")
        .select("id")
        .eq("appointment_id", body.appointment_id)
        .limit(1)
        .maybeSingle();

      if (lookupErr) {
        return json(500, { ok: false, error: lookupErr.message });
      }

      if (existing) {
        const { error: updateErr } = await admin
          .from("expert_reports")
          .update({
            expert_id: body.expert_id,
            claimant_id: body.claimant_id,
            report_status: body.report_status,
            report_submitted_date: body.report_submitted_date,
            payment_status: body.payment_status,
            payment_date: body.payment_date,
            notes: body.notes,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (updateErr) {
          return json(500, { ok: false, error: updateErr.message });
        }
        const out: ResponseBody = {
          ok: true,
          action: "updated",
          id: existing.id,
          appointment_id: body.appointment_id,
        };
        return json(200, out);
      }
    }

    // Insert path (no appointment_id, or no existing row)
    const { data: inserted, error: insertErr } = await admin
      .from("expert_reports")
      .insert({
        appointment_id: body.appointment_id ?? null,
        expert_id: body.expert_id,
        claimant_id: body.claimant_id,
        report_status: body.report_status,
        report_submitted_date: body.report_submitted_date,
        payment_status: body.payment_status,
        payment_date: body.payment_date,
        notes: body.notes,
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertErr) {
      // Race against the partial unique index — recover by updating
      if ((insertErr as { code?: string }).code === "23505" && body.appointment_id) {
        const { data: existingRow } = await admin
          .from("expert_reports")
          .select("id")
          .eq("appointment_id", body.appointment_id)
          .limit(1)
          .maybeSingle();

        if (existingRow) {
          await admin
            .from("expert_reports")
            .update({
              expert_id: body.expert_id,
              claimant_id: body.claimant_id,
              report_status: body.report_status,
              report_submitted_date: body.report_submitted_date,
              payment_status: body.payment_status,
              payment_date: body.payment_date,
              notes: body.notes,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingRow.id);

          const out: ResponseBody = {
            ok: true,
            action: "updated",
            id: existingRow.id,
            appointment_id: body.appointment_id,
          };
          return json(200, out);
        }
      }
      return json(500, { ok: false, error: insertErr.message });
    }

    const out: ResponseBody = {
      ok: true,
      action: "inserted",
      id: inserted!.id,
      appointment_id: body.appointment_id ?? null,
    };
    return json(201, out);
  } catch (e) {
    return json(500, {
      ok: false,
      error: e instanceof Error ? e.message : "Unexpected server error",
    });
  }
});
