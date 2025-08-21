import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DeleteUserRequest {
  userId: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId }: DeleteUserRequest = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: "User ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
      console.error("Missing Supabase environment variables");
      return new Response(
        JSON.stringify({ error: "Server misconfiguration: missing Supabase env" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Authenticated client (from caller) to verify admin
    const supabase = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });

    // Verify caller is authenticated and an admin
    const {
      data: { user },
      error: getUserError,
    } = await supabase.auth.getUser();

    if (getUserError || !user) {
      console.error("Unauthorized access attempt", getUserError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || profile?.role !== "admin") {
      console.error("Forbidden: non-admin tried to delete user", profileError);
      return new Response(JSON.stringify({ error: "Forbidden: Admin access required" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Check if the user being deleted exists and get their information
    const { data: targetProfile, error: targetProfileError } = await supabase
      .from("profiles")
      .select("email, role")
      .eq("id", userId)
      .single();

    if (targetProfileError || !targetProfile) {
      console.error("User not found:", targetProfileError);
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Prevent admins from deleting themselves
    if (userId === user.id) {
      return new Response(JSON.stringify({ error: "Cannot delete your own account" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Admin client for user deletion
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    console.log(`Admin ${user.email} attempting to delete user ${targetProfile.email}`);

    // Delete user from auth (this will cascade to profiles and other related data)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error("Failed to delete user:", deleteError);
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`User ${targetProfile.email} deleted successfully by admin ${user.email}`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "User deleted successfully",
      deletedUser: {
        email: targetProfile.email,
        role: targetProfile.role
      }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error) {
    console.error("Error in delete-user function:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || "Unexpected error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});