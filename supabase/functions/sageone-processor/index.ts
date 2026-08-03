import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_BATCH_LIMIT = 20;
const MAX_BATCH_LIMIT = 100;
const MAX_RETRIES = 3;
const MAX_ERROR_LENGTH = 2000;

type QueueItem = {
  id: string;
  appointment_id: string;
  payload: Record<string, unknown>;
};

type ProcessorRequest = {
  appointmentId?: string;
  limit?: number;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const truncateError = (value: unknown) => {
  const raw = value instanceof Error ? value.message : String(value ?? "Unknown error");
  return raw.length > MAX_ERROR_LENGTH ? `${raw.slice(0, MAX_ERROR_LENGTH)}...` : raw;
};

const toTransactionId = (response: any): string | null => {
  const direct = response?.transaction_id ?? response?.transactionId ?? response?.id ?? response?.InvoiceID;
  if (direct == null || direct === "") return null;
  return String(direct);
};

async function callSageOneCreateInvoice(
  apiUrl: string,
  apiKey: string,
  payload: Record<string, unknown>,
  taxCode?: string | null,
): Promise<any> {
  const body = {
    invoice: {
      reference: payload.appointment_reference ?? payload.appointment_id,
      appointmentId: payload.appointment_id,
      appointmentDate: payload.appointment_date,
      referringAttorneyId: payload.referring_attorney_id,
      claimantId: payload.claimant_id,
      expertId: payload.expert_id,
      amount: payload.amount,
      currency: payload.currency ?? "ZAR",
      notes: payload.notes ?? "",
      paymentTerms: payload.payment_terms ?? null,
      ...(taxCode ? { taxCode } : {}),
    },
  };

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: apiKey,
          "x-api-key": apiKey,
        },
        body: JSON.stringify(body),
      });

      const rawText = await response.text();
      const parsed = (() => {
        if (!rawText) return null;
        try {
          return JSON.parse(rawText);
        } catch {
          return rawText;
        }
      })();

      if (response.ok) {
        return parsed;
      }

      const shouldRetry = response.status === 429 || response.status >= 500;
      const message = `SageOne API error ${response.status}: ${typeof parsed === "string" ? parsed : JSON.stringify(parsed)}`;
      lastError = new Error(message);

      if (!shouldRetry || attempt === MAX_RETRIES) {
        throw lastError;
      }
    } catch (error) {
      lastError = error;
      if (attempt === MAX_RETRIES) {
        throw error;
      }
    }

    const delay = Math.min(1000 * (2 ** (attempt - 1)), 4000);
    await sleep(delay);
  }

  throw lastError ?? new Error("Unknown SageOne API error");
}

async function processQueueItem(
  supabase: ReturnType<typeof createClient>,
  apiUrl: string,
  apiKey: string,
  item: QueueItem,
  taxCode?: string | null,
) {
  const { data: claimedData, error: claimError } = await supabase
    .from("sageone_invoice_queue")
    .update({ status: "processing", error: null, processed_at: null })
    .eq("id", item.id)
    .eq("status", "pending")
    .select("id, appointment_id, payload")
    .maybeSingle();

  const claimedRow = (claimedData ?? null) as QueueItem | null;

  if (claimError) {
    throw claimError;
  }

  if (!claimedRow) {
    return { status: "skipped" as const, reason: "already-claimed" };
  }

  try {
    const result = await callSageOneCreateInvoice(apiUrl, apiKey, claimedRow.payload ?? {}, taxCode);
    const transactionId = toTransactionId(result);

    const { error: successError } = await supabase
      .from("sageone_invoice_queue")
      .update({
        status: "success",
        sageone_transaction_id: transactionId,
        error: null,
        processed_at: new Date().toISOString(),
      })
      .eq("id", claimedRow.id);

    if (successError) {
      throw successError;
    }

    if (transactionId) {
      const { error: appointmentUpdateError } = await supabase
        .from("appointments")
        .update({ sageone_transaction_id: transactionId } as never)
        .eq("id", claimedRow.appointment_id);

      if (appointmentUpdateError) {
        const code = (appointmentUpdateError as { code?: string }).code;
        const message = appointmentUpdateError.message || "Unknown appointments update error";
        if (code === "PGRST204" || /sageone_transaction_id/i.test(message)) {
          console.warn("appointments.sageone_transaction_id column not available; skipping update", { appointmentId: claimedRow.appointment_id });
        } else {
          console.warn("Failed to update appointments.sageone_transaction_id", {
            appointmentId: claimedRow.appointment_id,
            error: message,
          });
        }
      }
    }

    return {
      status: "success" as const,
      queueId: claimedRow.id,
      appointmentId: claimedRow.appointment_id,
      sageoneTransactionId: transactionId,
    };
  } catch (error) {
    const truncatedError = truncateError(error);

    await supabase
      .from("sageone_invoice_queue")
      .update({
        status: "failed",
        error: truncatedError,
        processed_at: new Date().toISOString(),
      })
      .eq("id", claimedRow.id);

    return {
      status: "failed" as const,
      queueId: claimedRow.id,
      appointmentId: claimedRow.appointment_id,
      error: truncatedError,
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const sageOneApiUrl = Deno.env.get("SAGEONE_API_URL");
    const sageOneApiKey = Deno.env.get("SAGEONE_API_KEY");
    const sageOneTaxCode = Deno.env.get("SAGEONE_TAX_CODE");

    if (!supabaseUrl || !serviceRoleKey || !sageOneApiUrl || !sageOneApiKey) {
      return new Response(JSON.stringify({
        error: "Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE, SAGEONE_API_URL, SAGEONE_API_KEY",
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => ({}))) as ProcessorRequest;
    const limit = Math.max(1, Math.min(Number(body.limit ?? DEFAULT_BATCH_LIMIT), MAX_BATCH_LIMIT));

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    let query = supabase
      .from("sageone_invoice_queue")
      .select("id, appointment_id, payload")
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (body.appointmentId) {
      query = query.eq("appointment_id", body.appointmentId).limit(1);
    } else {
      query = query.limit(limit);
    }

    const { data: pendingItems, error: fetchError } = await query;

    if (fetchError) {
      throw fetchError;
    }

    const queueItems = (pendingItems ?? []) as QueueItem[];

    if (queueItems.length === 0) {
      return new Response(JSON.stringify({
        processed: 0,
        message: body.appointmentId
          ? "No pending queue item for appointment"
          : "No pending queue items",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];
    for (const item of queueItems) {
      // Sequential processing keeps concurrency bounded while still supporting batch runs.
      results.push(await processQueueItem(supabase, sageOneApiUrl, sageOneApiKey, item, sageOneTaxCode));
    }

    const summary = results.reduce(
      (acc, result) => {
        acc[result.status] = (acc[result.status] ?? 0) + 1;
        return acc;
      },
      { success: 0, failed: 0, skipped: 0 } as Record<string, number>,
    );

    return new Response(JSON.stringify({
      processed: results.length,
      summary,
      results,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = truncateError(error);
    console.error("sageone-processor failed", { error: message });

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
