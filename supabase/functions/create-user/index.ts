import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmail } from '../_shared/email.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
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
})