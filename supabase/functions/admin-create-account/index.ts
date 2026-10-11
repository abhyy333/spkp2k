import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function randomPassword(length = 16) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => alphabet[n % alphabet.length]).join('');
}

function normalizeNip(value: unknown) {
  return String(value ?? '').replace(/\D/g, '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ code: 'METHOD_NOT_ALLOWED' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json({ code: 'SERVER_CONFIG_ERROR' }, 500);

  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!jwt) return json({ code: 'SESSION_EXPIRED' }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: callerData, error: callerError } = await admin.auth.getUser(jwt);
  const caller = callerData?.user;
  if (callerError || !caller) return json({ code: 'SESSION_EXPIRED' }, 401);

  const { data: callerAccount, error: callerAccountError } = await admin
    .from('authorized_accounts')
    .select('email,role,is_active,is_system_owner,user_id')
    .eq('user_id', caller.id)
    .eq('is_active', true)
    .maybeSingle();

  if (callerAccountError) return json({ code: 'AUTHORIZATION_CHECK_FAILED' }, 500);
  if (!callerAccount || callerAccount.role !== 'ADMIN') return json({ code: 'FORBIDDEN' }, 403);

  let payload: any;
  try { payload = await req.json(); }
  catch { return json({ code: 'INVALID_BODY' }, 400); }

  const lecturerId = payload?.lecturer_id ? String(payload.lecturer_id).trim() : null;
  const requestedRole = String(payload?.role ?? (lecturerId ? 'DOSEN' : 'ADMIN')).trim().toUpperCase();
  if (!['ADMIN', 'DOSEN'].includes(requestedRole)) return json({ code: 'INVALID_ROLE' }, 400);

  let email = '';
  let fullName = '';
  let temporaryPassword = '';
  let nip: string | null = null;

  if (requestedRole === 'DOSEN') {
    if (!lecturerId) return json({ code: 'LECTURER_REQUIRED' }, 400);

    const { data: lecturer, error: lecturerError } = await admin
      .from('lecturers')
      .select('id,name,nip,profile_id,status')
      .eq('id', lecturerId)
      .maybeSingle();

    if (lecturerError) return json({ code: 'LECTURER_LOOKUP_FAILED' }, 500);
    if (!lecturer) return json({ code: 'LECTURER_NOT_FOUND' }, 404);
    if (lecturer.status !== 'Aktif') return json({ code: 'LECTURER_INACTIVE' }, 409);
    if (lecturer.profile_id) return json({ code: 'LECTURER_ALREADY_LINKED' }, 409);

    // NIP is academic identity only; login always uses the Admin-entered email.
    nip = normalizeNip(lecturer.nip) || null;

    const { data: linkedAccount, error: linkedError } = await admin
      .from('authorized_accounts')
      .select('email,user_id,lecturer_id')
      .eq('lecturer_id', lecturerId)
      .limit(1)
      .maybeSingle();
    if (linkedError) return json({ code: 'ACCOUNT_LOOKUP_FAILED' }, 500);
    if (linkedAccount?.user_id) return json({ code: 'LECTURER_ALREADY_LINKED' }, 409);

    email = String(payload?.email ?? '').trim().toLowerCase();
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) || email.endsWith('@auth.spkjte.local') || email.endsWith('.local')) {
      return json({ code: 'INVALID_EMAIL', message: 'Masukkan email login yang valid.' }, 400);
    }
    fullName = String(lecturer.name ?? '').trim();
    temporaryPassword = randomPassword();
  } else {
    email = String(payload?.email ?? '').trim().toLowerCase();
    fullName = String(payload?.full_name ?? '').trim();
    if (!email || !email.includes('@') || !fullName) return json({ code: 'INVALID_INPUT' }, 400);
    if (lecturerId) return json({ code: 'ADMIN_LECTURER_NOT_ALLOWED' }, 400);
    temporaryPassword = randomPassword();
  }

  const { data: existingRows, error: existingError } = await admin
    .from('authorized_accounts')
    .select('email,role,lecturer_id,user_id,is_active,is_system_owner')
    .ilike('email', email)
    .limit(1);
  if (existingError) return json({ code: 'ACCOUNT_LOOKUP_FAILED' }, 500);

  const existing = existingRows?.[0] ?? null;
  if (existing?.user_id) {
    return json({ code: requestedRole === 'DOSEN' ? 'LECTURER_ALREADY_LINKED' : 'EMAIL_ALREADY_EXISTS' }, 409);
  }
  if (existing && (existing.role !== requestedRole || (existing.lecturer_id ?? null) !== lecturerId)) {
    return json({ code: 'PREAUTHORIZED_ACCOUNT_CONFLICT' }, 409);
  }

  let insertedPreauth = false;
  if (!existing) {
    const { error: preauthError } = await admin.from('authorized_accounts').insert({
      email,
      role: requestedRole,
      lecturer_id: requestedRole === 'DOSEN' ? lecturerId : null,
      user_id: null,
      is_active: true,
      is_system_owner: false,
      must_change_password: true,
      created_by: caller.id,
    });
    if (preauthError) return json({ code: 'PREAUTH_CREATE_FAILED' }, 500);
    insertedPreauth = true;
  } else {
    const { error: preauthUpdateError } = await admin
      .from('authorized_accounts')
      .update({ is_active: true, must_change_password: true, updated_at: new Date().toISOString() })
      .eq('email', existing.email);
    if (preauthUpdateError) return json({ code: 'PREAUTH_UPDATE_FAILED' }, 500);
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createError || !created.user) {
    if (insertedPreauth) {
      await admin.from('authorized_accounts').delete().eq('email', email).is('user_id', null);
    }
    const msg = (createError?.message ?? '').toLowerCase();
    if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
      return json({ code: requestedRole === 'DOSEN' ? 'LECTURER_ACCOUNT_EXISTS' : 'EMAIL_ALREADY_EXISTS' }, 409);
    }
    return json({ code: 'AUTH_CREATE_FAILED' }, 500);
  }

  const userId = created.user.id;

  const { error: finalizeError } = await admin
    .from('authorized_accounts')
    .update({ must_change_password: true, updated_at: new Date().toISOString() })
    .eq('email', email)
    .eq('user_id', userId);

  if (finalizeError) {
    await admin.auth.admin.deleteUser(userId);
    if (insertedPreauth) await admin.from('authorized_accounts').delete().eq('email', email).is('user_id', null);
    return json({ code: 'ACCOUNT_FINALIZE_FAILED' }, 500);
  }

  return json({
    success: true,
    user_id: userId,
    email,
    role: requestedRole,
    lecturer_id: requestedRole === 'DOSEN' ? lecturerId : null,
    nip,
    temporary_password: temporaryPassword,
  });
});
