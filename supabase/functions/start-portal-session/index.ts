import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withErrorHandler } from "../_shared/errors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Instead of returning a bare JSON case list, this function provisions
// (or reuses) a real, low-privilege Supabase Auth account for the
// attorney/expert tied to their access code, then mints a one-time login
// token for it. The client exchanges that token for a real session via
// supabase.auth.verifyOtp(), landing them in the existing attorney-portal /
// expert-portal UI — which already scopes every query correctly via RLS
// policies keyed to profiles.referring_attorney_id / profiles.expert_id.
// No new access-control logic needed: we're reusing what already works
// for staff-created attorney/expert accounts.

Deno.serve(withErrorHandler(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { access_code, person_type } = await req.json();

    if (!access_code || typeof access_code !== "string" || access_code.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Access code is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (person_type !== "attorney" && person_type !== "expert") {
      return new Response(
        JSON.stringify({ error: "Invalid person_type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const codeTable = person_type === "attorney" ? "attorney_access_codes" : "expert_access_codes";
    const idColumn = person_type === "attorney" ? "referring_attorney_id" : "expert_id";
    const personTable = person_type === "attorney" ? "referring_attorneys" : "medical_experts";
    const profileLinkColumn = person_type === "attorney" ? "referring_attorney_id" : "expert_id";
    const roleValue = person_type === "attorney" ? "referring_attorney" : "medical_expert";
    const redirectPath = person_type === "attorney" ? "/attorney-portal" : "/expert-portal";

    // ---- 1. Validate the access code (same rules as the read-only validators) ----
    const { data: codeData, error: codeError } = await supabase
      .from(codeTable)
      .select(`id, ${idColumn}, is_active, expires_at`)
      .eq("access_code", access_code.trim())
      .single();

    if (codeError || !codeData) {
      return new Response(
        JSON.stringify({ error: "Invalid access link. Please check the link and try again." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!codeData.is_active) {
      return new Response(
        JSON.stringify({ error: "This access link is no longer active. Please contact us for a new one." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (codeData.expires_at && new Date(codeData.expires_at) < new Date()) {
      await supabase
        .from(codeTable)
        .update({ is_active: false, deactivated_at: new Date().toISOString(), deactivation_reason: "Expired after 1 year" })
        .eq("id", codeData.id);

      return new Response(
        JSON.stringify({ error: "This access link has expired. Please contact us for a new one." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const personId = (codeData as Record<string, unknown>)[idColumn] as string;

    // ---- 2. Get the person's on-file email (needed to sign them in) ----
    const { data: person, error: personError } = await supabase
      .from(personTable)
      .select("id, email, first_name, last_name, name")
      .eq("id", personId)
      .single();

    if (personError || !person?.email) {
      return new Response(
        JSON.stringify({ error: "No email is on file for this account. Please contact our office to set this up." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- 3. Find an existing linked profile, or provision one ----
    let userId: string | null = null;

    const { data: linkedProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq(profileLinkColumn, personId)
      .maybeSingle();

    if (linkedProfile) {
      userId = linkedProfile.id;
    } else {
      // Not linked yet — check if an account with this email already
      // exists (e.g. staff created one manually) before creating a new one.
      const { data: profileByEmail } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", person.email)
        .maybeSingle();

      if (profileByEmail) {
        userId = profileByEmail.id;
        await supabase
          .from("profiles")
          .update({ [profileLinkColumn]: personId, role: roleValue })
          .eq("id", userId);
      } else {
        const { data: created, error: createError } = await supabase.auth.admin.createUser({
          email: person.email,
          email_confirm: true,
          user_metadata: { provisioned_via: "portal_access_code", person_type },
        });

        if (createError || !created?.user) {
          return new Response(
            JSON.stringify({ error: "Could not set up portal access. Please contact our office." }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        userId = created.user.id;

        await supabase.from("profiles").upsert({
          id: userId,
          email: person.email,
          first_name: person.first_name ?? (person.name ? person.name.split(" ")[0] : null),
          last_name: person.last_name ?? (person.name ? person.name.split(" ").slice(1).join(" ") : null),
          role: roleValue,
          [profileLinkColumn]: personId,
        });

        await supabase.from("user_roles").upsert(
          { user_id: userId, role: roleValue },
          { onConflict: "user_id,role" }
        );
      }
    }

    // ---- 4. Mint a one-time login token for that account ----
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: person.email,
    });

    if (linkError || !linkData?.properties?.hashed_token) {
      return new Response(
        JSON.stringify({ error: "Could not start your portal session. Please try the link again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- 5. Track usage on the access code itself ----
    await supabase
      .from(codeTable)
      .update({
        last_accessed_at: new Date().toISOString(),
        access_count: (codeData as { access_count?: number }).access_count
          ? (codeData as { access_count: number }).access_count + 1
          : 1,
      })
      .eq("id", codeData.id);

    return new Response(
      JSON.stringify({
        email: person.email,
        token_hash: linkData.properties.hashed_token,
        redirect_path: redirectPath,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error starting portal session:", err);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}));
