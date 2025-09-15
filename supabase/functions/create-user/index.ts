import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create admin client with service role key
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

    // Create regular client to verify admin user
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    console.log('Creating user - function started')

    // Verify the caller is an admin
    const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !currentUser) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if current user is admin - prioritize boshomane@kutlwanoassociate.com as main admin
    const isMainAdmin = currentUser.email === 'boshomane@kutlwanoassociate.com'
    
    let isAdmin = isMainAdmin
    if (!isMainAdmin) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, user_type')
        .eq('id', currentUser.id)
        .single()

      isAdmin = profile && (profile.role === 'admin' || profile.user_type === 'admin')
    }

    if (!isAdmin) {
      console.error('User is not admin:', currentUser.email)
      return new Response(
        JSON.stringify({ error: 'Administrative privileges required. Contact boshomane@kutlwanoassociate.com for access.' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Parse request body
    const { email, password, firstName, lastName, role, userType, position, lawFirmId, permissions } = await req.json()

    console.log('Creating user with email:', email)

    // Use the production domain for email redirects
    const origin = 'https://kamedico-legal.co.za';

    // Create user with admin client and send confirmation email
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // Require email confirmation
      user_metadata: {
        first_name: firstName,
        last_name: lastName
      }
    })

    if (createError) {
      console.error('Error creating user:', createError)
      return new Response(
        JSON.stringify({ error: createError.message }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!newUser.user) {
      console.error('No user returned from creation')
      return new Response(
        JSON.stringify({ error: 'Failed to create user' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('User created successfully:', newUser.user.id)

    // Send confirmation email using Supabase's native email service
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
        // Don't fail user creation if email fails
      } else {
        console.log('Confirmation email sent successfully to:', email);
      }
    } catch (emailErr) {
      console.error('Failed to send confirmation email:', emailErr);
    }

    // Create profile for the new user
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: newUser.user.id,
        email: email,
        first_name: firstName,
        last_name: lastName,
        role: role || 'user',
        user_type: userType || 'user',
        position: position || null,
        law_firm_id: lawFirmId || null
      })

    if (profileError) {
      console.error('Error creating profile:', profileError)
      // Don't fail completely, but log the error
    } else {
      console.log('Profile created successfully')
    }

    // Grant permissions if not admin and permissions provided
    if (role !== 'admin' && permissions && Array.isArray(permissions)) {
      console.log('Granting permissions:', permissions)
      
      for (const permission of permissions) {
        const { error: permError } = await supabaseAdmin
          .from('user_permissions')
          .upsert({
            user_id: newUser.user.id,
            permission_name: permission,
            granted: true,
            granted_by: currentUser.id
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
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})