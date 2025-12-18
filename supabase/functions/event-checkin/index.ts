import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

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

      console.log(`Fetching event with checkin code: ${code}`)

      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('id, title, description, scheduled_at, address, modality, account_id')
        .eq('checkin_code', code.toUpperCase())
        .eq('modality', 'presencial')
        .single()

      if (eventError || !event) {
        console.error('Event not found:', eventError)
        return new Response(
          JSON.stringify({ error: 'Evento não encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log(`Found event: ${event.title}`)

      return new Response(
        JSON.stringify({ event }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // POST - Register attendance
    if (req.method === 'POST') {
      const { code, phone } = await req.json()

      if (!code || !phone) {
        return new Response(
          JSON.stringify({ error: 'Código do evento e telefone são obrigatórios' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log(`Check-in attempt: code=${code}, phone=${phone}`)

      // Find event by checkin code
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('id, title, account_id')
        .eq('checkin_code', code.toUpperCase())
        .eq('modality', 'presencial')
        .single()

      if (eventError || !event) {
        console.error('Event not found:', eventError)
        return new Response(
          JSON.stringify({ error: 'Evento não encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Normalize phone to E.164 format
      const normalizedPhone = phone.replace(/\D/g, '')
      const phoneE164 = normalizedPhone.startsWith('55') 
        ? `+${normalizedPhone}` 
        : `+55${normalizedPhone}`

      console.log(`Looking for client with phone: ${phoneE164}`)

      // Find client by phone in the same account
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id, full_name')
        .eq('account_id', event.account_id)
        .eq('phone_e164', phoneE164)
        .single()

      if (clientError || !client) {
        console.error('Client not found:', clientError)
        return new Response(
          JSON.stringify({ error: 'Cliente não encontrado. Verifique se o telefone está cadastrado.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log(`Found client: ${client.full_name}`)

      // Check if already checked in
      const { data: existingAttendance } = await supabase
        .from('attendance')
        .select('id')
        .eq('event_id', event.id)
        .eq('client_id', client.id)
        .single()

      if (existingAttendance) {
        console.log('Client already checked in')
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
        console.error('Error creating attendance:', attendanceError)
        return new Response(
          JSON.stringify({ error: 'Erro ao registrar presença' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log(`Check-in successful for ${client.full_name}`)

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
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
