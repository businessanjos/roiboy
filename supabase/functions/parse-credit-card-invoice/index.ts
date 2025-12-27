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

    const { invoice_text, account_id, bank_account_id, invoice_date } = await req.json();

    if (!invoice_text || !account_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Processing credit card invoice for account:', account_id);

    // Use AI to extract transactions from invoice text
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
            content: `Você é um especialista em extrair transações de faturas de cartão de crédito.
Analise o texto da fatura e extraia todas as transações.

IMPORTANTE:
- Extraia data, descrição e valor de cada transação
- Valores devem ser números positivos (sem R$, sem pontos de milhar, vírgula como decimal)
- Datas no formato YYYY-MM-DD
- Identifique a categoria quando possível (alimentação, transporte, serviços, compras, etc.)
- Ignore linhas de cabeçalho, totais, pagamentos anteriores
- Foque apenas nas compras/transações individuais`
          },
          {
            role: 'user',
            content: `Extraia as transações desta fatura de cartão de crédito:\n\n${invoice_text}`
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
                        amount: { type: 'number', description: 'Valor da transação (positivo)' },
                        category: { type: 'string', description: 'Categoria sugerida' },
                        installment: { type: 'string', description: 'Parcela (ex: 2/12) se aplicável' }
                      },
                      required: ['date', 'description', 'amount']
                    }
                  },
                  total_amount: { type: 'number', description: 'Valor total da fatura' },
                  due_date: { type: 'string', description: 'Data de vencimento (YYYY-MM-DD)' }
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
      throw new Error('Failed to process invoice with AI');
    }

    const aiData = await aiResponse.json();
    console.log('AI response:', JSON.stringify(aiData, null, 2));

    // Extract the tool call result
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
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
