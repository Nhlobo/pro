// Edge function: upload-pop-attachment
// Receives a base64-encoded POP file, stores it in the `payment-pops` bucket,
// inserts a row into payment_pop_attachments, and links it to the parent record.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_MIME = new Set(["application/pdf", "image/jpeg", "image/png", "image/jpg"]);
const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const VALID_RECORD_TYPES = new Set(["appointment_request", "aod_payment", "expert_payment"]);
const RECORD_TYPE_TO_TABLE: Record<string, string> = {
  appointment_request: "appointment_requests",
  aod_payment: "aod_payments",
  expert_payment: "expert_payments",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

interface Body {
  record_type: string;
  record_id: string;
  file_base64: string;
  file_name: string;
  mime_type: string;
  payment_reference?: string;
  notes?: string;
}

async function ensureBucket(admin: ReturnType<typeof createClient>) {
  const { data } = await admin.storage.getBucket("payment-pops");
  if (!data) {
    await admin.storage.createBucket("payment-pops", {
      public: false,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
    });
  }
}

function decodeBase64(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.split(",")[1] : b64;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body: Body = await req.json();
    if (!VALID_RECORD_TYPES.has(body.record_type)) {
      return new Response(JSON.stringify({ error: "Invalid record_type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!body.record_id || !body.file_base64 || !body.file_name || !body.mime_type) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!ALLOWED_MIME.has(body.mime_type.toLowerCase())) {
      return new Response(JSON.stringify({ error: "Unsupported file type. Allowed: PDF, JPG, PNG." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bytes = decodeBase64(body.file_base64);
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
      return new Response(JSON.stringify({ error: "File size must be between 1 byte and 10MB" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    await ensureBucket(admin);

    const safeName = body.file_name.replace(/[^A-Za-z0-9._-]/g, "_");
    const path = `${body.record_type}/${body.record_id}/${Date.now()}_${safeName}`;

    const { error: uploadErr } = await admin.storage
      .from("payment-pops")
      .upload(path, bytes, { contentType: body.mime_type, upsert: false });
    if (uploadErr) {
      return new Response(JSON.stringify({ error: `Upload failed: ${uploadErr.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: row, error: insertErr } = await admin
      .from("payment_pop_attachments")
      .insert({
        record_type: body.record_type,
        record_id: body.record_id,
        payment_reference: body.payment_reference?.trim() || null,
        file_path: path,
        file_name: body.file_name,
        file_size_bytes: bytes.byteLength,
        mime_type: body.mime_type,
        notes: body.notes ?? null,
        uploaded_by: userId,
      })
      .select()
      .single();

    if (insertErr || !row) {
      await admin.storage.from("payment-pops").remove([path]);
      return new Response(JSON.stringify({ error: insertErr?.message || "Insert failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Link to parent record
    const parentTable = RECORD_TYPE_TO_TABLE[body.record_type];
    await admin
      .from(parentTable)
      .update({ pop_attachment_id: row.id, payment_reference: row.payment_reference })
      .eq("id", body.record_id);

    // Audit log
    await admin.from("audit_logs").insert({
      user_id: userId,
      action: "pop_uploaded",
      table_name: "payment_pop_attachments",
      record_id: row.id,
      metadata: {
        record_type: body.record_type,
        record_id: body.record_id,
        payment_reference: row.payment_reference,
        file_name: body.file_name,
      },
    });

    return new Response(JSON.stringify({ success: true, attachment: row }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("upload-pop-attachment error", err);
    return new Response(JSON.stringify({ error: err.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
