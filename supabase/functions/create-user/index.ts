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

    // sendMagicLink=true lets the admin invite the user without setting a password.
    // The user receives a magic-link email and sets their own password via the
    // /reset-password flow on first login.
    const sendMagicLink = requestBody.sendMagicLink === true;

    // Basic validation
    if (!requestBody.email || !requestBody.firstName || !requestBody.lastName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, firstName, lastName' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!sendMagicLink && !requestBody.password) {
      return new Response(
        JSON.stringify({ error: 'Password is required unless sendMagicLink is true' }),
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

    // Validate password strength (min 8 chars) when password flow is used
    if (!sendMagicLink && requestBody.password.length < 8) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 8 characters long' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate role
    const validRoles = ['admin', 'employee', 'referring_attorney', 'user', 'sales_consultant'];
    const role = requestBody.role || 'user';
    if (!validRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: 'Invalid role. Must be one of: ' + validRoles.join(', ') }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, password, firstName, lastName, lawFirmId, userType, position, permissions } = requestBody;

    console.log('Creating user with email:', email)

    const origin = 'https://kamedico-legal.co.za';

    // Create user — when sendMagicLink, the user is pre-confirmed so they can sign in via the link.
    const createPayload: any = {
      email,
      email_confirm: sendMagicLink, // magic-link invites skip the confirm step
      user_metadata: { first_name: firstName, last_name: lastName },
    };
    if (!sendMagicLink) createPayload.password = password;

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser(createPayload);

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

    // Send invitation / confirmation email through the project email service.
    try {
      const linkType = sendMagicLink ? 'magiclink' : 'signup';
      const linkPayload: any = {
        type: linkType,
        email,
        options: { redirectTo: sendMagicLink ? `${origin}/reset-password` : `${origin}/` },
      };
      if (!sendMagicLink) linkPayload.password = password;

      const { data: linkData, error: emailError } =
        await supabaseAdmin.auth.admin.generateLink(linkPayload);

      if (emailError || !linkData?.properties?.action_link) {
        console.error('Error generating invite/confirmation link:', emailError);
      } else {
        const actionLink = linkData.properties.action_link;
        const subject = sendMagicLink
          ? 'Welcome to Medico-Legal Pro – Set up your account'
          : 'Confirm your email - Medico-Legal Pro';
        const heading = sendMagicLink ? 'Welcome to Medico-Legal Pro' : 'Confirm Your Email';
        const body = sendMagicLink
          ? `An administrator has created an account for you. Click the button below to sign in securely. You'll be prompted to set your own password on first login.`
          : `Please click the button below to confirm your email address and activate your account.`;
        const cta = sendMagicLink ? 'Sign in &amp; set password' : 'Confirm Email';

        const emailResult = await sendEmail({
          to: email,
          subject,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; color: #1f2937;">
              <div style="text-align:center; border-bottom: 1px solid #e5e7eb; padding-bottom: 18px; margin-bottom: 24px;">
                <h1 style="margin:0; color:#0f172a; font-size:24px;">${heading}</h1>
                <p style="margin:8px 0 0; color:#64748b;">Medico-Legal Pro</p>
              </div>
              <p>${body}</p>
              <div style="text-align:center; margin: 32px 0;">
                <a href="${actionLink}" style="background-color:#0ea5e9; color:#ffffff; padding: 13px 28px; text-decoration:none; border-radius:6px; display:inline-block; font-weight:bold;">${cta}</a>
              </div>
              <p style="font-size:13px; color:#64748b;">If the button does not work, copy and paste this link into your browser:</p>
              <p style="font-size:12px; word-break:break-all; color:#0284c7;">${actionLink}</p>
              <p style="font-size:12px; color:#94a3b8; margin-top:28px;">If you did not expect this email, you can safely ignore it.</p>
            </div>
          `
        });
        if (!emailResult.success) console.error('Error sending email:', emailResult.error);
        else console.log('Email sent successfully to:', email);
      }
    } catch (emailErr) {
      console.error('Failed to send invitation email:', emailErr);
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
    } else {
      console.log('Profile created successfully')
    }

    // Grant role in user_roles table
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