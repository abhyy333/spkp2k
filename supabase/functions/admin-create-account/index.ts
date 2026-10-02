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
    const { email, full_name, role, lecturer_id } = await req.json()
    const cleanEmail = email?.trim().toLowerCase()
    const cleanRole = role?.trim().toUpperCase()

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return new Response(JSON.stringify({ error: 'INVALID_INPUT', message: 'Format email tidak valid.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (cleanRole !== 'ADMIN' && cleanRole !== 'DOSEN') {
      return new Response(JSON.stringify({ error: 'INVALID_INPUT', message: 'Role tidak valid.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (cleanRole === 'DOSEN' && !lecturer_id) {
      return new Response(JSON.stringify({ error: 'LECTURER_REQUIRED', message: 'Dosen pengampu wajib dipilih.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if lecturer exists and is not already linked to another active account
    if (cleanRole === 'DOSEN' && lecturer_id) {
      const { data: lecturer, error: lecturerError } = await supabaseAdmin
        .from('lecturers')
        .select('id, name')
        .eq('id', lecturer_id)
        .maybeSingle()

      if (lecturerError || !lecturer) {
        return new Response(JSON.stringify({ error: 'LECTURER_NOT_FOUND', message: 'Dosen tidak ditemukan.' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: existingLink } = await supabaseAdmin
        .from('authorized_accounts')
        .select('email')
        .eq('lecturer_id', lecturer_id)
        .eq('is_active', true)
        .maybeSingle()

      if (existingLink && existingLink.email?.toLowerCase() !== cleanEmail) {
        return new Response(JSON.stringify({ error: 'LECTURER_ALREADY_LINKED', message: 'Dosen tersebut sudah memiliki akun.' }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Check duplicate email
    const { data: existingEmail } = await supabaseAdmin
      .from('authorized_accounts')
      .select('email')
      .eq('email', cleanEmail)
      .eq('is_active', true)
      .maybeSingle()

    if (existingEmail) {
      return new Response(JSON.stringify({ error: 'EMAIL_ALREADY_EXISTS', message: 'Email sudah terdaftar.' }), {
        status: 409,
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

    // Create auth user
    const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: full_name || (cleanRole === 'ADMIN' ? 'Administrator' : 'Dosen'),
      }
    })

    if (createUserError || !newUser?.user) {
      return new Response(JSON.stringify({ error: 'AUTH_CREATION_FAILED', message: createUserError?.message || 'Gagal membuat pengguna auth.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userId = newUser.user.id

    // Create applications records
    // 1. authorized_accounts
    const { error: insertAuthError } = await supabaseAdmin
      .from('authorized_accounts')
      .upsert({
        email: cleanEmail,
        role: cleanRole,
        user_id: userId,
        lecturer_id: cleanRole === 'DOSEN' ? lecturer_id : null,
        is_active: true,
        must_change_password: true,
        created_by: caller.id,
        updated_at: new Date().toISOString()
      }, { onConflict: 'email' })

    if (insertAuthError) {
      // Rollback auth user
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return new Response(JSON.stringify({ error: 'DB_CREATION_FAILED', message: 'Gagal membuat data otorisasi akun.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. profiles
    const { error: insertProfileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        email: cleanEmail,
        name: full_name || (cleanRole === 'ADMIN' ? 'Administrator' : 'Dosen'),
        full_name: full_name || (cleanRole === 'ADMIN' ? 'Administrator' : 'Dosen'),
        role: cleanRole,
        is_active: true,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })

    if (insertProfileError) {
      // Rollback auth user
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return new Response(JSON.stringify({ error: 'DB_CREATION_FAILED', message: 'Gagal membuat profil akun.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Update lecturers table if DOSEN
    if (cleanRole === 'DOSEN' && lecturer_id) {
      const { error: updateLecturerError } = await supabaseAdmin
        .from('lecturers')
        .update({
          profile_id: userId,
          email: cleanEmail,
        })
        .eq('id', lecturer_id)

      if (updateLecturerError) {
        console.warn('Warning: Gagal menghubungkan dosen ke profil:', updateLecturerError)
      }
    }

    return new Response(JSON.stringify({
      success: true,
      user_id: userId,
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
