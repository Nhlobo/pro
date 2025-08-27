import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UserManagementRequest {
  action: 'create' | 'update' | 'delete' | 'list' | 'get' | 'change_password'
  userId?: string
  userData?: {
    email: string
    password?: string
    first_name?: string
    last_name?: string
    role?: string
    law_firm_id?: string
  }
  newPassword?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 401 
        }
      )
    }

    // Verify the user is authenticated
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      console.error('Authentication error:', authError)
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 401 
        }
      )
    }

    // Check if user has admin role
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || profile?.role !== 'admin') {
      console.error('Authorization error:', profileError)
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 403 
        }
      )
    }

    const requestData: UserManagementRequest = await req.json()
    console.log('User management request:', requestData.action)

    switch (requestData.action) {
      case 'create':
        return await createUser(supabaseClient, requestData.userData!)

      case 'update':
        return await updateUser(supabaseClient, requestData.userId!, requestData.userData!)

      case 'delete':
        return await deleteUser(supabaseClient, requestData.userId!)

      case 'list':
        return await listUsers(supabaseClient)

      case 'get':
        return await getUser(supabaseClient, requestData.userId!)

      case 'change_password':
        return await changeUserPassword(supabaseClient, requestData.userId!, requestData.newPassword!)

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
            status: 400 
          }
        )
    }

  } catch (error) {
    console.error('User management error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 500 
      }
    )
  }
})

async function createUser(supabaseClient: any, userData: any) {
  try {
    // Create user in auth
    const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true,
      user_metadata: {
        first_name: userData.first_name,
        last_name: userData.last_name
      }
    })

    if (authError) {
      console.error('Auth user creation error:', authError)
      return new Response(
        JSON.stringify({ error: `Failed to create user: ${authError.message}` }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 400 
        }
      )
    }

    // Create profile
    const { data: profileData, error: profileError } = await supabaseClient
      .from('profiles')
      .insert({
        id: authData.user.id,
        email: userData.email,
        first_name: userData.first_name,
        last_name: userData.last_name,
        role: userData.role || 'user',
        law_firm_id: userData.law_firm_id || null
      })
      .select()
      .single()

    if (profileError) {
      console.error('Profile creation error:', profileError)
      // Clean up auth user if profile creation fails
      await supabaseClient.auth.admin.deleteUser(authData.user.id)
      return new Response(
        JSON.stringify({ error: `Failed to create user profile: ${profileError.message}` }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 400 
        }
      )
    }

    console.log('User created successfully:', authData.user.id)
    return new Response(
      JSON.stringify({ 
        success: true, 
        user: {
          id: authData.user.id,
          email: authData.user.email,
          ...profileData
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 201 
      }
    )

  } catch (error) {
    console.error('Create user error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to create user' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 500 
      }
    )
  }
}

async function updateUser(supabaseClient: any, userId: string, userData: any) {
  try {
    // Update profile
    const { data: profileData, error: profileError } = await supabaseClient
      .from('profiles')
      .update({
        first_name: userData.first_name,
        last_name: userData.last_name,
        role: userData.role,
        law_firm_id: userData.law_firm_id
      })
      .eq('id', userId)
      .select()
      .single()

    if (profileError) {
      console.error('Profile update error:', profileError)
      return new Response(
        JSON.stringify({ error: `Failed to update user: ${profileError.message}` }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 400 
        }
      )
    }

    // Update auth metadata if needed
    if (userData.first_name || userData.last_name) {
      await supabaseClient.auth.admin.updateUserById(userId, {
        user_metadata: {
          first_name: userData.first_name,
          last_name: userData.last_name
        }
      })
    }

    console.log('User updated successfully:', userId)
    return new Response(
      JSON.stringify({ success: true, user: profileData }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 200 
      }
    )

  } catch (error) {
    console.error('Update user error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to update user' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 500 
      }
    )
  }
}

async function deleteUser(supabaseClient: any, userId: string) {
  try {
    // Delete user from auth (this will cascade delete the profile due to foreign key)
    const { error: authError } = await supabaseClient.auth.admin.deleteUser(userId)

    if (authError) {
      console.error('Auth user deletion error:', authError)
      return new Response(
        JSON.stringify({ error: `Failed to delete user: ${authError.message}` }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 400 
        }
      )
    }

    console.log('User deleted successfully:', userId)
    return new Response(
      JSON.stringify({ success: true, message: 'User deleted successfully' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 200 
      }
    )

  } catch (error) {
    console.error('Delete user error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to delete user' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 500 
      }
    )
  }
}

async function listUsers(supabaseClient: any) {
  try {
    const { data: profiles, error: profileError } = await supabaseClient
      .from('profiles')
      .select(`
        id,
        email,
        first_name,
        last_name,
        role,
        law_firm_id,
        created_at,
        updated_at,
        law_firms:law_firm_id (
          name,
          code
        )
      `)
      .order('created_at', { ascending: false })

    if (profileError) {
      console.error('List users error:', profileError)
      return new Response(
        JSON.stringify({ error: `Failed to list users: ${profileError.message}` }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 400 
        }
      )
    }

    return new Response(
      JSON.stringify({ success: true, users: profiles }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 200 
      }
    )

  } catch (error) {
    console.error('List users error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to list users' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 500 
      }
    )
  }
}

async function getUser(supabaseClient: any, userId: string) {
  try {
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select(`
        id,
        email,
        first_name,
        last_name,
        role,
        law_firm_id,
        created_at,
        updated_at,
        law_firms:law_firm_id (
          name,
          code
        )
      `)
      .eq('id', userId)
      .single()

    if (profileError) {
      console.error('Get user error:', profileError)
      return new Response(
        JSON.stringify({ error: `Failed to get user: ${profileError.message}` }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 400 
        }
      )
    }

    return new Response(
      JSON.stringify({ success: true, user: profile }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 200 
      }
    )

  } catch (error) {
    console.error('Get user error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to get user' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 500 
      }
    )
  }
}

async function changeUserPassword(supabaseClient: any, userId: string, newPassword: string) {
  try {
    console.log(`Admin attempting to change password for user ${userId}`)

    // Validate password strength
    if (!newPassword || newPassword.length < 8) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 8 characters long' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 400 
        }
      )
    }

    // Update user password using admin API with immediate effect
    const { data: userData, error: authError } = await supabaseClient.auth.admin.updateUserById(userId, {
      password: newPassword,
      // Force password change to take effect immediately by updating user metadata
      user_metadata: {
        password_changed_at: new Date().toISOString(),
        force_password_refresh: true
      }
    })

    if (authError) {
      console.error('Auth password update error:', authError)
      return new Response(
        JSON.stringify({ error: `Failed to change password: ${authError.message}` }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 400 
        }
      )
    }

    // Optionally, invalidate all sessions for this user to force re-authentication
    try {
      console.log(`Invalidating sessions for user ${userId} to force immediate password change effect`)
      await supabaseClient.auth.admin.signOut(userId, 'global')
      console.log(`Sessions invalidated for user ${userId}`)
    } catch (signOutError) {
      // Non-critical error, password was still changed
      console.log(`Warning: Could not invalidate sessions for user ${userId}:`, signOutError)
    }

    console.log(`Password changed successfully for user ${userId}`)
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Password changed successfully. User will need to log in again with the new password.',
        user: userData.user,
        requiresReauth: true
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 200 
      }
    )

  } catch (error) {
    console.error('Change password error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to change password' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 500 
      }
    )
  }
}