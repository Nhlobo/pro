import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { access_code, requests } = body;

    // Validate access code
    if (!access_code || typeof access_code !== "string" || access_code.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Access code is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!requests || !Array.isArray(requests) || requests.length === 0) {
      return new Response(
        JSON.stringify({ error: "At least one request is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseKey);

    // Validate the access code
    const { data: codeData, error: codeError } = await adminClient
      .from("attorney_access_codes")
      .select("id, referring_attorney_id, is_active")
      .eq("access_code", access_code.trim())
      .maybeSingle();

    if (codeError || !codeData) {
      return new Response(
        JSON.stringify({ error: "Invalid access code." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!codeData.is_active) {
      return new Response(
        JSON.stringify({ error: "This access code has been deactivated." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch attorney info
    const { data: attorney } = await adminClient
      .from("referring_attorneys")
      .select("id, name, email")
      .eq("id", codeData.referring_attorney_id)
      .maybeSingle();

    if (!attorney) {
      return new Response(
        JSON.stringify({ error: "Attorney not found." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const insertedIds: string[] = [];
    const emailsQueued: string[] = [];

    for (const reqItem of requests) {
      // Basic validation per request
      const claimantFirstName = (reqItem.claimant_first_name || "").trim();
      const claimantLastName = (reqItem.claimant_last_name || "").trim();

      if (!claimantFirstName) {
        continue; // Skip invalid entries
      }

      const additionalNotes = (reqItem.additional_notes || "").substring(0, 5000) || null;

      const { data: inserted, error: insertError } = await adminClient
        .from("appointment_requests")
        .insert({
          claimant_first_name: claimantFirstName.substring(0, 200),
          claimant_last_name: claimantLastName.substring(0, 200),
          expert_type_requested: (reqItem.expert_type_requested || "To be determined").substring(0, 200),
          matter_type: (reqItem.matter_type || "To be determined").substring(0, 200),
          province: (reqItem.province || "To be determined").substring(0, 200),
          preferred_date_type: reqItem.preferred_date_type || "any_date",
          suggested_date: reqItem.suggested_date || null,
          is_minor: reqItem.is_minor || false,
          guardian_name: reqItem.guardian_name || null,
          additional_notes: additionalNotes,
          referring_attorney_id: attorney.id,
          referring_attorney_name: attorney.name,
          attorney_email: attorney.email || null,
          requested_by: attorney.id,
          status: "pending",
        })
        .select("id")
        .single();

      if (!insertError && inserted) {
        insertedIds.push(inserted.id);
      } else {
        console.error("Insert error:", insertError);
      }

      // Check if this is an email request — queue a real email to admin + CC
      const isEmailRequest = additionalNotes && additionalNotes.startsWith("[EMAIL REQUEST]");
      if (isEmailRequest && inserted) {
        // Parse subject, CC, and body from the notes
        const lines = additionalNotes.split("\n");
        let emailSubject = "New Appointment Request";
        let ccAddresses: string[] = [];
        let emailBodyLines: string[] = [];
        let bodyStarted = false;

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (!bodyStarted) {
            if (line.startsWith("Subject: ")) {
              emailSubject = line.replace("Subject: ", "").trim();
            } else if (line.startsWith("CC: ")) {
              ccAddresses = line.replace("CC: ", "").split(",").map((e: string) => e.trim()).filter((e: string) => e.length > 0);
            } else if (line.trim() === "") {
              bodyStarted = true;
            }
          } else {
            emailBodyLines.push(line);
          }
        }

        const emailBody = emailBodyLines.join("\n").trim();

        // Build the HTML email content
        const htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #1fb6ce; padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 20px;">New Appointment Request</h1>
            </div>
            <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
              <h3 style="color: #1fb6ce; margin-top: 0;">From: ${attorney.name}</h3>
              ${attorney.email ? `<p><strong>Attorney Email:</strong> ${attorney.email}</p>` : ""}
              ${ccAddresses.length > 0 ? `<p><strong>CC:</strong> ${ccAddresses.join(", ")}</p>` : ""}
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 15px 0;" />
              <div style="white-space: pre-wrap;">${emailBody.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 15px 0;" />
              <p style="font-size: 12px; color: #6b7280;">
                <em>This request was submitted via the Case Access Portal.</em>
              </p>
            </div>
          </div>
        `;

        // Queue the email to admin
        const adminEmail = "noreply@kamedico-legal.co.za";
        const { error: queueError } = await adminClient
          .from("email_queue")
          .insert({
            email_type: "appointment_request_email",
            recipient_email: adminEmail,
            recipient_name: "Kutlwano & Associate Admin",
            subject: `${emailSubject} - ${attorney.name}`,
            html_content: htmlContent,
            status: "pending",
            related_record_id: inserted.id,
            related_table: "appointment_requests",
            metadata: {
              attorney_name: attorney.name,
              attorney_email: attorney.email,
              cc_addresses: ccAddresses,
              source: "case_access_portal",
            },
          });

        if (queueError) {
          console.error("Failed to queue admin email:", queueError);
        } else {
          emailsQueued.push(adminEmail);
          console.log(`Queued email to admin for request ${inserted.id}`);
        }

        // Queue individual CC emails
        for (const ccEmail of ccAddresses) {
          const { error: ccQueueError } = await adminClient
            .from("email_queue")
            .insert({
              email_type: "appointment_request_email_cc",
              recipient_email: ccEmail,
              recipient_name: ccEmail,
              subject: `${emailSubject} - ${attorney.name}`,
              html_content: htmlContent,
              status: "pending",
              related_record_id: inserted.id,
              related_table: "appointment_requests",
              metadata: {
                attorney_name: attorney.name,
                attorney_email: attorney.email,
                cc_addresses: ccAddresses,
                source: "case_access_portal",
                is_cc: true,
              },
            });

          if (ccQueueError) {
            console.error(`Failed to queue CC email to ${ccEmail}:`, ccQueueError);
          } else {
            emailsQueued.push(ccEmail);
            console.log(`Queued CC email to ${ccEmail} for request ${inserted.id}`);
          }
        }
      }
    }

    console.log(`Inserted ${insertedIds.length} appointment requests for attorney ${attorney.name}. Emails queued: ${emailsQueued.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        inserted_count: insertedIds.length,
        ids: insertedIds,
        emails_queued: emailsQueued.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error in submit-appointment-request:", err);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
