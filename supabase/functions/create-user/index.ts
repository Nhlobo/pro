import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmail } from '../_shared/email.ts'
import { withErrorHandler } from "../_shared/errors.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(withErrorHandler(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    console.log('Creating user - function started')

    // Verify authentication
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    
    if (authError || !user) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify admin using secure user_roles table
    const { data: isAdmin } = await supabaseClient
      .rpc('has_role', { _user_id: user.id, _role: 'admin' });

    if (!isAdmin) {
      console.log('Access denied - User is not an admin');
      return new Response(
        JSON.stringify({ error: 'Access denied. Admin privileges required.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate request body
    const requestBody = await req.json();
    
    // Basic validation
    if (!requestBody.email || !requestBody.password || !requestBody.firstName || !requestBody.lastName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, password, firstName, lastName' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(requestBody.email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate password strength (min 8 chars)
    if (requestBody.password.length < 8) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 8 characters long' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate role — restricted to the 5 canonical internal roles.
    // referring_attorney/medical_expert are NOT valid here: those are
    // exclusively for the separate external_portal_accounts system
    // (bridged via the external-portal-auth function), confirmed several
    // rounds ago to still be actively used by the old system's own
    // /auth login for real external users -- an internal-staff creation
    // flow must never be able to produce an account holding either
    // value. 'user' is likewise not a real role (it's the code's
    // fallback for "no role assigned"), so it's excluded too.
    const validRoles = ['admin', 'employee', 'sales_consultant', 'finance', 'director'];
    const role = requestBody.role;
    if (!role || !validRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: 'Invalid role. Must be one of: ' + validRoles.join(', ') }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, password, firstName, lastName, lawFirmId, userType, position, permissions } = requestBody;

    console.log('Creating user with email:', email)

    const origin = 'https://kamedico-legal.co.za';
    const normalizedEmail = email.trim().toLowerCase();

    // Reject a REAL duplicate up front with a clear message, before ever
    // touching auth.admin.createUser -- a person visible in User Management
    // (i.e. has a profiles row) is a genuine "this email is taken".
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (existingProfile) {
      return new Response(
        JSON.stringify({ error: `A user with email ${email} already exists in User Management.` }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Look up (paginated) whether an Auth account already exists for this
    // email with NO matching profile. This happens when a previous
    // create-user call created the Auth account but a later step (profile
    // insert, role grant, etc.) failed -- nothing rolled the Auth account
    // back, so it lingers forever: invisible in User Management (which
    // only reads `profiles`), yet auth.admin.createUser() will reject any
    // future attempt at the same email as "already registered". That
    // combination -- "looks free, but creation says it's taken" -- is
    // exactly the bug this block exists to self-heal instead of leaving
    // an admin to hunt for it manually in the Auth dashboard every time.
    let orphanedAuthUserId: string | null = null;
    {
      const maxPages = 20; // 20 x 1000 = up to 20,000 accounts scanned
      for (let page = 1; page <= maxPages; page++) {
        const { data: pageData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage: 1000,
        });
        if (listError || !pageData?.users?.length) break;
        const match = pageData.users.find(
          (u) => (u.email ?? '').toLowerCase() === normalizedEmail
        );
        if (match) {
          orphanedAuthUserId = match.id;
          break;
        }
        if (pageData.users.length < 1000) break; // last page
      }
    }

    if (orphanedAuthUserId) {
      console.log('Found orphaned Auth account with no profile for this email, removing it first:', orphanedAuthUserId);
      const { error: deleteOrphanError } = await supabaseAdmin.auth.admin.deleteUser(orphanedAuthUserId);
      if (deleteOrphanError) {
        console.error('Failed to remove orphaned Auth account:', deleteOrphanError);
        return new Response(
          JSON.stringify({
            error:
              'An account for this email exists in Authentication but has no profile, and it could not be automatically removed. ' +
              'Please delete it manually in Supabase Dashboard -> Authentication -> Users, then try again.',
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Create user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: {
        first_name: firstName,
        last_name: lastName
      }
    })

    if (createError) {
      console.error('Error creating user:', createError)
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!newUser.user) {
      console.error('No user returned from creation')
      return new Response(
        JSON.stringify({ error: 'Failed to create user' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('User created successfully:', newUser.user.id)

    // Send confirmation email through the project email service instead of relying on Supabase SMTP.
    try {
      const { data: linkData, error: emailError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'signup',
        email: email,
        password,
        options: {
          redirectTo: `${origin}/`
        }
      });
      
      if (emailError || !linkData?.properties?.action_link) {
        console.error('Error generating confirmation email link:', emailError);
      } else {
        const actionLink = linkData.properties.action_link;
        const emailResult = await sendEmail({
          to: email,
          subject: 'Confirm your email - Medico-Legal Pro',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; color: #1f2937;">
              <div style="text-align:center; border-bottom: 1px solid #e5e7eb; padding-bottom: 18px; margin-bottom: 24px;">
                <h1 style="margin:0; color:#0f172a; font-size:24px;">Confirm Your Email</h1>
                <p style="margin:8px 0 0; color:#64748b;">Medico-Legal Pro</p>
              </div>
              <p>Please click the button below to confirm your email address and activate your account.</p>
              <div style="text-align:center; margin: 32px 0;">
                <a href="${actionLink}" style="background-color:#0ea5e9; color:#ffffff; padding: 13px 28px; text-decoration:none; border-radius:6px; display:inline-block; font-weight:bold;">Confirm Email</a>
              </div>
              <p style="font-size:13px; color:#64748b;">If the button does not work, copy and paste this link into your browser:</p>
              <p style="font-size:12px; word-break:break-all; color:#0284c7;">${actionLink}</p>
              <p style="font-size:12px; color:#94a3b8; margin-top:28px;">If you did not request this email, you can safely ignore it.</p>
            </div>
          `
        });

        if (!emailResult.success) {
          console.error('Error sending confirmation email:', emailResult.error);
        } else {
          console.log('Confirmation email sent successfully to:', email);
        }
      }
    } catch (emailErr) {
      console.error('Failed to send confirmation email:', emailErr);
    }

    // Create profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: newUser.user.id,
        email: email,
        first_name: firstName,
        last_name: lastName,
        role: role,
        user_type: userType || 'user',
        position: position || null,
        law_firm_id: lawFirmId || null
      })

    if (profileError) {
      console.error('Error creating profile:', profileError)
      // Without a profile row this account is invisible in User Management
      // and would become exactly the kind of orphaned Auth account this
      // function now has to detect-and-clean-up on every future attempt
      // at this email (see the lookup above). Roll it back here instead
      // of leaving that trap for next time.
      const { error: rollbackError } = await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      if (rollbackError) {
        console.error('Failed to roll back Auth account after profile creation failure:', rollbackError);
      }
      return new Response(
        JSON.stringify({ error: 'Failed to create user profile: ' + profileError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    console.log('Profile created successfully')

    // Grant role in user_roles table (legacy/old-system source of truth
    // — kept in sync deliberately, same discipline established over the
    // last several rounds after finding profiles.role/user_roles drift
    // on multiple real accounts)
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: newUser.user.id,
        role: role,
        granted_by: user.id
      });

    if (roleError) {
      console.error('Error granting role:', roleError);
    }

    // Grant the SAME role in the new system's own access_role_assignments
    // table. This is a separate, additive write -- it does not read from
    // or depend on user_roles/profiles in any way, and a failure here
    // does not roll back the account creation above (the account still
    // works for the old system either way; an admin can always assign
    // the new-system role afterward via Manage Access if this insert
    // happens to fail).
    const { error: newSystemRoleError } = await supabaseAdmin
      .from('access_role_assignments')
      .insert({
        user_id: newUser.user.id,
        role_key: role,
        assigned_by: user.id
      });

    if (newSystemRoleError) {
      console.error('Error granting new-system role assignment:', newSystemRoleError);
    }

    // Grant permissions
    if (role !== 'admin' && permissions && Array.isArray(permissions)) {
      console.log('Granting permissions:', permissions)
      
      for (const permission of permissions) {
        const { error: permError } = await supabaseAdmin
          .from('user_permissions')
          .upsert({
            user_id: newUser.user.id,
            permission_name: permission,
            granted: true,
            granted_by: user.id
          })
        
        if (permError) {
          console.error(`Error granting permission ${permission}:`, permError)
        }
      }
    }

    console.log('User creation completed successfully')

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: {
          id: newUser.user.id,
          email: newUser.user.email
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}))
