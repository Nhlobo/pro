import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    const validRoles = ['admin', 'employee', 'referring_attorney', 'user'];
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

    // Send confirmation email
    try {
      const { error: emailError } = await supabaseAdmin.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${origin}/`
        }
      });
      
      if (emailError) {
        console.error('Error sending confirmation email:', emailError);
      } else {
        console.log('Confirmation email sent successfully to:', email);
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