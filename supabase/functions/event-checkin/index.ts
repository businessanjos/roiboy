import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Rate limit configuration
const RATE_LIMIT_MAX_REQUESTS = 10 // Max requests per window
const RATE_LIMIT_WINDOW_SECONDS = 60 // 1 minute window

// Input validation
function validateCheckinCode(code: string): boolean {
  // Code should be 6 alphanumeric characters
  return /^[A-Z0-9]{6}$/i.test(code)
}

function validatePhone(phone: string): boolean {
  // Phone should have 10-15 digits
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 15
}

function sanitizeInput(input: string): string {
  // Remove potential XSS characters
  return input.replace(/[<>'"&]/g, '').trim()
}

function getClientIP(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
         req.headers.get('x-real-ip') || 
         'unknown'
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const clientIP = getClientIP(req)

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const url = new URL(req.url)
    
    // GET - Fetch event info by checkin code
    if (req.method === 'GET') {
      const code = url.searchParams.get('code')
      
      if (!code) {
        return new Response(
          JSON.stringify({ error: 'Código do evento não informado' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Validate and sanitize input
      const sanitizedCode = sanitizeInput(code).toUpperCase()
      if (!validateCheckinCode(sanitizedCode)) {
        console.warn(`[${clientIP}] Invalid checkin code format: ${code}`)
        return new Response(
          JSON.stringify({ error: 'Código do evento inválido' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check rate limit for GET requests (less strict)
      const { data: canProceed } = await supabase.rpc('check_rate_limit', {
        p_identifier: clientIP,
        p_action: 'event_checkin_lookup',
        p_max_requests: 30,
        p_window_seconds: 60
      })

      if (!canProceed) {
        console.warn(`[${clientIP}] Rate limit exceeded for event lookup`)
        return new Response(
          JSON.stringify({ error: 'Muitas tentativas. Aguarde um momento.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Record the request
      await supabase.rpc('record_rate_limit_hit', {
        p_identifier: clientIP,
        p_action: 'event_checkin_lookup'
      })

      console.log(`[${clientIP}] Fetching event with checkin code: ${sanitizedCode}`)

      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('id, title, description, scheduled_at, address, modality, account_id')
        .eq('checkin_code', sanitizedCode)
        .eq('modality', 'presencial')
        .single()

      if (eventError || !event) {
        console.error(`[${clientIP}] Event not found:`, eventError)
        return new Response(
          JSON.stringify({ error: 'Evento não encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log(`[${clientIP}] Found event: ${event.title}`)

      return new Response(
        JSON.stringify({ event }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // POST - Register attendance
    if (req.method === 'POST') {
      const body = await req.json()
      const { code, phone } = body

      if (!code || !phone) {
        return new Response(
          JSON.stringify({ error: 'Código do evento e telefone são obrigatórios' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Validate and sanitize inputs
      const sanitizedCode = sanitizeInput(code).toUpperCase()
      const sanitizedPhone = sanitizeInput(phone)

      if (!validateCheckinCode(sanitizedCode)) {
        console.warn(`[${clientIP}] Invalid checkin code format: ${code}`)
        return new Response(
          JSON.stringify({ error: 'Código do evento inválido' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!validatePhone(sanitizedPhone)) {
        console.warn(`[${clientIP}] Invalid phone format: ${phone}`)
        return new Response(
          JSON.stringify({ error: 'Telefone inválido' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check rate limit (strict for POST)
      const { data: canProceed } = await supabase.rpc('check_rate_limit', {
        p_identifier: clientIP,
        p_action: 'event_checkin_submit',
        p_max_requests: RATE_LIMIT_MAX_REQUESTS,
        p_window_seconds: RATE_LIMIT_WINDOW_SECONDS
      })

      if (!canProceed) {
        console.warn(`[${clientIP}] Rate limit exceeded for check-in submission`)
        
        // Log security event
        await supabase.from('security_audit_logs').insert({
          event_type: 'rate_limit_exceeded',
          ip_address: clientIP,
          user_agent: req.headers.get('user-agent'),
          details: { action: 'event_checkin', code: sanitizedCode }
        })
        
        return new Response(
          JSON.stringify({ error: 'Muitas tentativas. Aguarde um momento.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Record the request
      await supabase.rpc('record_rate_limit_hit', {
        p_identifier: clientIP,
        p_action: 'event_checkin_submit'
      })

      console.log(`[${clientIP}] Check-in attempt: code=${sanitizedCode}, phone=${sanitizedPhone.substring(0, 4)}****`)

      // Find event by checkin code
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('id, title, account_id')
        .eq('checkin_code', sanitizedCode)
        .eq('modality', 'presencial')
        .single()

      if (eventError || !event) {
        console.error(`[${clientIP}] Event not found:`, eventError)
        return new Response(
          JSON.stringify({ error: 'Evento não encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Normalize phone to E.164 format
      const normalizedPhone = sanitizedPhone.replace(/\D/g, '')
      const phoneE164 = normalizedPhone.startsWith('55') 
        ? `+${normalizedPhone}` 
        : `+55${normalizedPhone}`

      console.log(`[${clientIP}] Looking for client with phone: ${phoneE164.substring(0, 6)}****`)

      // Find client by phone in the same account
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id, full_name')
        .eq('account_id', event.account_id)
        .eq('phone_e164', phoneE164)
        .single()

      if (clientError || !client) {
        console.error(`[${clientIP}] Client not found:`, clientError)
        return new Response(
          JSON.stringify({ error: 'Cliente não encontrado. Verifique se o telefone está cadastrado.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log(`[${clientIP}] Found client: ${client.full_name}`)

      // Check if already checked in
      const { data: existingAttendance } = await supabase
        .from('attendance')
        .select('id')
        .eq('event_id', event.id)
        .eq('client_id', client.id)
        .single()

      if (existingAttendance) {
        console.log(`[${clientIP}] Client already checked in`)
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Você já fez check-in neste evento!',
            client_name: client.full_name,
            event_title: event.title,
            already_checked_in: true
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Create attendance record
      const { error: attendanceError } = await supabase
        .from('attendance')
        .insert({
          account_id: event.account_id,
          event_id: event.id,
          client_id: client.id,
          join_time: new Date().toISOString()
        })

      if (attendanceError) {
        console.error(`[${clientIP}] Error creating attendance:`, attendanceError)
        return new Response(
          JSON.stringify({ error: 'Erro ao registrar presença' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Log successful check-in
      await supabase.from('security_audit_logs').insert({
        event_type: 'event_checkin_success',
        account_id: event.account_id,
        ip_address: clientIP,
        user_agent: req.headers.get('user-agent'),
        details: { 
          event_id: event.id, 
          event_title: event.title,
          client_id: client.id 
        }
      })

      console.log(`[${clientIP}] Check-in successful for ${client.full_name}`)

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Check-in realizado com sucesso!',
          client_name: client.full_name,
          event_title: event.title
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error(`[${clientIP}] Unexpected error:`, error)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})