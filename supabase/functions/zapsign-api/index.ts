import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ZAPSIGN_API_URL = 'https://api.zapsign.com.br/api/v1';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const zapsignToken = Deno.env.get('ZAPSIGN_API_TOKEN');

    if (!zapsignToken) {
      return new Response(JSON.stringify({ error: 'ZapSign API token not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's account
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('account_id')
      .eq('auth_user_id', user.id)
      .single();

    if (userError || !userData) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accountId = userData.account_id;
    const { action, ...payload } = await req.json();

    console.log(`ZapSign API action: ${action}`);

    const zapsignHeaders = {
      'Authorization': `Bearer ${zapsignToken}`,
      'Content-Type': 'application/json',
    };

    let result;

    switch (action) {
      case 'list-templates': {
        const response = await fetch(`${ZAPSIGN_API_URL}/templates/`, {
          method: 'GET',
          headers: zapsignHeaders,
        });
        result = await response.json();
        break;
      }

      case 'list-documents': {
        const page = payload.page || 1;
        const response = await fetch(`${ZAPSIGN_API_URL}/docs/?page=${page}`, {
          method: 'GET',
          headers: zapsignHeaders,
        });
        result = await response.json();
        break;
      }

      case 'get-document': {
        const { docToken } = payload;
        if (!docToken) {
          return new Response(JSON.stringify({ error: 'docToken is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const response = await fetch(`${ZAPSIGN_API_URL}/docs/${docToken}/`, {
          method: 'GET',
          headers: zapsignHeaders,
        });
        result = await response.json();
        break;
      }

      case 'create-document-upload': {
        const { name, base64_pdf, signers, external_id, lang } = payload;
        
        if (!name || !base64_pdf || !signers || signers.length === 0) {
          return new Response(JSON.stringify({ error: 'name, base64_pdf and signers are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const response = await fetch(`${ZAPSIGN_API_URL}/docs/`, {
          method: 'POST',
          headers: zapsignHeaders,
          body: JSON.stringify({
            name,
            base64_pdf,
            signers,
            external_id: external_id || '',
            lang: lang || 'pt-br',
          }),
        });

        result = await response.json();
        console.log('ZapSign create-document-upload response:', JSON.stringify(result));

        // Save to database if successful
        if (result.token) {
          const { error: insertError } = await supabase
            .from('zapsign_documents')
            .insert({
              account_id: accountId,
              client_id: payload.client_id || null,
              contract_id: payload.contract_id || null,
              zapsign_doc_token: result.token,
              name: result.name,
              status: result.status || 'pending',
              original_file_url: result.original_file,
              signers: result.signers || [],
              external_id: external_id || null,
            });

          if (insertError) {
            console.error('Error saving ZapSign document to DB:', insertError);
          }
        }
        break;
      }

      case 'create-document-template': {
        const { template_id, signer_name, signer_email, signer_phone, data, external_id } = payload;
        
        if (!template_id || !signer_name) {
          return new Response(JSON.stringify({ error: 'template_id and signer_name are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const requestBody: any = {
          template_id,
          signer_name,
        };

        if (signer_email) requestBody.signer_email = signer_email;
        if (signer_phone) requestBody.signer_phone = signer_phone;
        if (data) requestBody.data = data;
        if (external_id) requestBody.external_id = external_id;

        const response = await fetch(`${ZAPSIGN_API_URL}/models/create-doc/`, {
          method: 'POST',
          headers: zapsignHeaders,
          body: JSON.stringify(requestBody),
        });

        result = await response.json();
        console.log('ZapSign create-document-template response:', JSON.stringify(result));

        // Save to database if successful
        if (result.token) {
          const { error: insertError } = await supabase
            .from('zapsign_documents')
            .insert({
              account_id: accountId,
              client_id: payload.client_id || null,
              contract_id: payload.contract_id || null,
              zapsign_doc_token: result.token,
              zapsign_template_id: template_id,
              name: result.name,
              status: result.status || 'pending',
              original_file_url: result.original_file,
              signers: result.signers || [],
              external_id: external_id || null,
            });

          if (insertError) {
            console.error('Error saving ZapSign document to DB:', insertError);
          }
        }
        break;
      }

      case 'delete-document': {
        const { docToken } = payload;
        if (!docToken) {
          return new Response(JSON.stringify({ error: 'docToken is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const response = await fetch(`${ZAPSIGN_API_URL}/docs/${docToken}/`, {
          method: 'DELETE',
          headers: zapsignHeaders,
        });

        if (response.ok) {
          // Remove from database
          await supabase
            .from('zapsign_documents')
            .delete()
            .eq('zapsign_doc_token', docToken)
            .eq('account_id', accountId);

          result = { success: true };
        } else {
          result = await response.json();
        }
        break;
      }

      case 'sync-document-status': {
        const { docToken } = payload;
        if (!docToken) {
          return new Response(JSON.stringify({ error: 'docToken is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const response = await fetch(`${ZAPSIGN_API_URL}/docs/${docToken}/`, {
          method: 'GET',
          headers: zapsignHeaders,
        });

        result = await response.json();

        if (result.token) {
          // Update in database
          const updateData: any = {
            status: result.status,
            signers: result.signers || [],
            original_file_url: result.original_file,
            signed_file_url: result.signed_file,
          };

          if (result.status === 'signed' && result.signed_file) {
            updateData.signed_at = new Date().toISOString();
          }

          await supabase
            .from('zapsign_documents')
            .update(updateData)
            .eq('zapsign_doc_token', docToken)
            .eq('account_id', accountId);
        }
        break;
      }

      case 'get-local-documents': {
        const { client_id, contract_id } = payload;
        
        let query = supabase
          .from('zapsign_documents')
          .select('*')
          .eq('account_id', accountId)
          .order('created_at', { ascending: false });

        if (client_id) {
          query = query.eq('client_id', client_id);
        }
        if (contract_id) {
          query = query.eq('contract_id', contract_id);
        }

        const { data: docs, error: docsError } = await query;

        if (docsError) {
          return new Response(JSON.stringify({ error: docsError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        result = docs;
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('ZapSign API error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
