import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Authenticate caller (verify JWT and get user info)
    const { data: { user: caller }, error: callerError } = await supabaseClient.auth.getUser()
    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: 'UNAUTHORIZED', message: 'Izin ditolak.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Connect to admin DB client (with service role to perform auth operations)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verify if caller is actually an active ADMIN in authorized_accounts
    const { data: callerAuth, error: authCheckError } = await supabaseAdmin
      .from('authorized_accounts')
      .select('role, is_active')
      .eq('user_id', caller.id)
      .eq('is_active', true)
      .eq('role', 'ADMIN')
      .maybeSingle()

    if (authCheckError || !callerAuth) {
      return new Response(JSON.stringify({ error: 'UNAUTHORIZED', message: 'Hanya administrator yang dapat melakukan tindakan ini.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get input parameters
    const { email } = await req.json()
    const cleanEmail = email?.trim().toLowerCase()

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return new Response(JSON.stringify({ error: 'INVALID_INPUT', message: 'Format email tidak valid.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if user exists in auth.users
    const { data: usersList, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    if (listError) {
      return new Response(JSON.stringify({ error: 'AUTH_API_ERROR', message: 'Gagal memeriksa daftar pengguna.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const targetUser = usersList.users.find(u => u.email?.toLowerCase() === cleanEmail)
    if (!targetUser) {
      return new Response(JSON.stringify({ error: 'USER_NOT_FOUND', message: 'Akun dengan email tersebut tidak ditemukan di sistem.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Generate cryptographically secure temporary password (16 chars)
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
    const array = new Uint8Array(16)
    crypto.getRandomValues(array)
    let tempPassword = 'JTE-'
    for (let i = 0; i < 12; i++) {
      tempPassword += chars[array[i] % chars.length]
    }

    // Update user password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
      password: tempPassword,
    })

    if (updateError) {
      return new Response(JSON.stringify({ error: 'PASSWORD_RESET_FAILED', message: 'Gagal memperbarui kata sandi pengguna.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Update must_change_password in authorized_accounts
    const { error: updateAuthError } = await supabaseAdmin
      .from('authorized_accounts')
      .update({
        must_change_password: true,
        updated_at: new Date().toISOString()
      })
      .eq('email', cleanEmail)

    if (updateAuthError) {
      console.warn('Warning: Gagal memperbarui status must_change_password di database:', updateAuthError)
    }

    return new Response(JSON.stringify({
      success: true,
      email: cleanEmail,
      temporary_password: tempPassword,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: 'UNKNOWN', message: err.message || 'Terjadi kesalahan internal.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
