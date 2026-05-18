import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { sendEmail } from "../_shared/email.ts";
import { z } from "npm:zod@3.22.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const Schema = z.object({
  to: z.string().min(3).max(1000),
  cc: z.string().max(1000).optional(),
  subject: z.string().min(1).max(500),
  message: z.string().max(20000).optional().default(''),
  filename: z.string().min(1).max(200),
  pdfBase64: z.string().min(1),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ success: false, error: parsed.error.flatten() }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { to, cc, subject, message, filename, pdfBase64 } = parsed.data;

    const recipients = to.split(',').map(s => s.trim()).filter(Boolean);
    const ccList = cc ? cc.split(',').map(s => s.trim()).filter(Boolean) : undefined;

    const safeMessage = (message || 'Please find attached the Expert Payment Planner report.')
      .replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string))
      .replace(/\n/g, '<br/>');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1fb6ce 0%, #159baf 100%); color: white; padding: 18px 20px; text-align: center; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="margin: 0; font-size: 16px;">KUTLWANO &amp; ASSOCIATES (PTY) LTD</h2>
          <p style="margin: 4px 0 0; font-size: 11px;">Expert Payment Planner</p>
        </div>
        <p style="color: #374151; font-size: 13px; line-height: 1.5;">${safeMessage}</p>
        <p style="color: #6b7280; font-size: 11px; margin-top: 24px;">📎 Attached: ${filename}</p>
      </div>`;

    const result = await sendEmail({
      to: recipients,
      cc: ccList,
      subject,
      html,
      attachments: [{ filename, content: pdfBase64 }],
    });

    if (!result.success) {
      return new Response(JSON.stringify(result), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err?.message || String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
