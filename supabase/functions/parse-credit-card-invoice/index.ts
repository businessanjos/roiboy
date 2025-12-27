import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const { invoice_text, invoice_base64, file_type, account_id, bank_account_id } = await req.json();

    if (!account_id) {
      return new Response(JSON.stringify({ error: 'Missing account_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!invoice_text && !invoice_base64) {
      return new Response(JSON.stringify({ error: 'Missing invoice content' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Processing credit card invoice for account:', account_id, 'file_type:', file_type);

    // Build the message content based on input type
    let messageContent: any[];
    
    if (invoice_base64 && file_type === 'pdf') {
      // For PDF files, send as image/document to AI
      messageContent = [
        {
          type: 'text',
          text: `Analise este PDF de fatura de cartão de crédito e extraia todas as transações.

IMPORTANTE:
- Extraia data, descrição e valor de cada transação
- Valores devem ser números positivos (sem R$, sem pontos de milhar, vírgula como decimal convertida para ponto)
- Datas no formato YYYY-MM-DD
- Identifique a categoria quando possível (alimentação, transporte, serviços, compras, etc.)
- Ignore linhas de cabeçalho, totais, pagamentos anteriores, informações do cartão
- Foque apenas nas compras/transações individuais
- Se houver parcelas, extraia a informação (ex: 2/12)`
        },
        {
          type: 'image_url',
          image_url: {
            url: `data:application/pdf;base64,${invoice_base64}`
          }
        }
      ];
    } else if (invoice_base64 && (file_type === 'image' || file_type === 'png' || file_type === 'jpg' || file_type === 'jpeg')) {
      // For image files
      const mimeType = file_type === 'png' ? 'image/png' : 'image/jpeg';
      messageContent = [
        {
          type: 'text',
          text: `Analise esta imagem de fatura de cartão de crédito e extraia todas as transações.

IMPORTANTE:
- Extraia data, descrição e valor de cada transação
- Valores devem ser números positivos (sem R$, sem pontos de milhar, vírgula como decimal convertida para ponto)
- Datas no formato YYYY-MM-DD
- Identifique a categoria quando possível
- Ignore cabeçalhos, totais, pagamentos anteriores
- Foque apenas nas compras/transações individuais`
        },
        {
          type: 'image_url',
          image_url: {
            url: `data:${mimeType};base64,${invoice_base64}`
          }
        }
      ];
    } else {
      // For text content (pasted or OFX/CSV parsed)
      messageContent = [
        {
          type: 'text',
          text: `Extraia as transações desta fatura de cartão de crédito:

${invoice_text}

IMPORTANTE:
- Extraia data, descrição e valor de cada transação
- Valores devem ser números positivos (sem R$, sem pontos de milhar, vírgula como decimal convertida para ponto)
- Datas no formato YYYY-MM-DD
- Identifique a categoria quando possível (alimentação, transporte, serviços, compras, etc.)
- Ignore linhas de cabeçalho, totais, pagamentos anteriores
- Foque apenas nas compras/transações individuais`
        }
      ];
    }

    // Use AI to extract transactions
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'Você é um especialista em extrair transações de faturas de cartão de crédito. Sempre retorne dados estruturados usando a função fornecida.'
          },
          {
            role: 'user',
            content: messageContent
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_transactions',
              description: 'Extrai transações da fatura de cartão de crédito',
              parameters: {
                type: 'object',
                properties: {
                  transactions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        date: { type: 'string', description: 'Data da transação (YYYY-MM-DD)' },
                        description: { type: 'string', description: 'Descrição/estabelecimento' },
                        amount: { type: 'number', description: 'Valor da transação (positivo, ponto como decimal)' },
                        category: { type: 'string', description: 'Categoria sugerida' },
                        installment: { type: 'string', description: 'Parcela (ex: 2/12) se aplicável' }
                      },
                      required: ['date', 'description', 'amount']
                    }
                  },
                  total_amount: { type: 'number', description: 'Valor total da fatura' },
                  due_date: { type: 'string', description: 'Data de vencimento (YYYY-MM-DD)' },
                  card_last_digits: { type: 'string', description: 'Últimos 4 dígitos do cartão se visível' }
                },
                required: ['transactions']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extract_transactions' } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns minutos.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error('Failed to process invoice with AI');
    }

    const aiData = await aiResponse.json();
    console.log('AI response received');

    // Extract the tool call result
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error('AI did not return structured data:', aiData);
      throw new Error('AI did not return structured data');
    }

    const extractedData = JSON.parse(toolCall.function.arguments);
    console.log('Extracted transactions:', extractedData.transactions?.length || 0);

    // Return extracted transactions for user review before importing
    return new Response(JSON.stringify({
      success: true,
      transactions: extractedData.transactions || [],
      total_amount: extractedData.total_amount,
      due_date: extractedData.due_date,
      card_last_digits: extractedData.card_last_digits,
      transaction_count: extractedData.transactions?.length || 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Invoice parsing error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});