import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { consultantId, consultantName, consultantEmail, managerEmail, currentAppts, strikeCount, strikeType, existingStrikes } = await req.json();

    // Create in-app notification
    const { data: consultant } = await supabase
      .from('sales_consultants')
      .select('user_id')
      .eq('id', consultantId)
      .single();

    if (consultant?.user_id) {
      await supabase.from('notifications').insert({
        user_id: consultant.user_id,
        title: 'Performance Warning',
        message: `Your monthly appointments (${currentAppts}) are below the target of 7. A ${strikeType} warning has been issued.`,
        type: 'warning',
        category: 'performance',
      });
    }

    // Send email if Resend is configured
    if (resendKey) {
      const resend = new Resend(resendKey);

      const strikeInfo = (existingStrikes || []).map((s: any) =>
        `• ${s.type} warning — issued ${s.issued_date}, expires ${s.expiry_date}`
      ).join('\n');

      const nextConsequence = strikeCount === 1 ? 'Written Warning' : strikeCount === 2 ? 'Dismissal' : 'Final';

      const emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1e3a5f; color: white; padding: 20px; text-align: center;">
            <h1>Performance Warning Notice</h1>
          </div>
          <div style="padding: 20px;">
            <p>Dear ${consultantName},</p>
            <p>This is to notify you that your monthly appointment count of <strong>${currentAppts}</strong> is below the required target of <strong>7 appointments</strong>.</p>
            <p>A <strong>${strikeType} warning</strong> has been issued (Strike ${strikeCount}/3).</p>
            ${strikeInfo ? `<p><strong>Current Strike Record:</strong></p><pre>${strikeInfo}</pre>` : ''}
            <p><strong>Next consequence if target is not met:</strong> ${nextConsequence}</p>
            <p>Please take immediate steps to improve your performance.</p>
          </div>
        </div>
      `;

      const recipients = [consultantEmail].filter(Boolean);
      if (managerEmail) recipients.push(managerEmail);

      if (recipients.length > 0) {
        await resend.emails.send({
          from: "Kutlwano Associates <onboarding@resend.dev>",
          to: recipients,
          subject: `⚠️ Performance Warning: ${consultantName} — Strike ${strikeCount}/3`,
          html: emailHtml,
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Performance warning error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
