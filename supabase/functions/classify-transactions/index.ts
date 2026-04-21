import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Transaction {
  description: string;
  amount: number;
  date: string;
  type: 'credit' | 'debit';
  external_id?: string;
}

interface ClassificationResult {
  original_description: string;
  suggested_description: string;
  suggested_category_id: string | null;
  suggested_category_name: string | null;
  suggested_client_id: string | null;
  suggested_client_name: string | null;
  ai_confidence: number;
  ai_reasoning: string;
  matched_rule_id: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { account_id, bank_account_id, transactions } = await req.json();

    if (!account_id || !transactions || !Array.isArray(transactions)) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing ${transactions.length} transactions for account ${account_id}`);

    // Fetch existing classification rules
    const { data: rules } = await supabase
      .from('financial_classification_rules')
      .select('*, category:financial_categories(id, name)')
      .eq('account_id', account_id)
      .eq('is_active', true)
      .order('confidence', { ascending: false });

    // Fetch categories for AI context
    const { data: categories } = await supabase
      .from('financial_categories')
      .select('id, name, category_type')
      .eq('account_id', account_id)
      .eq('is_active', true);

    // Fetch clients for matching
    const { data: clients } = await supabase
      .from('clients')
      .select('id, full_name, company_name, cnpj, cpf')
      .eq('account_id', account_id);

    const results: ClassificationResult[] = [];
    const pendingInserts: any[] = [];

    for (const tx of transactions as Transaction[]) {
      let classification: ClassificationResult = {
        original_description: tx.description,
        suggested_description: tx.description,
        suggested_category_id: null,
        suggested_category_name: null,
        suggested_client_id: null,
        suggested_client_name: null,
        ai_confidence: 0,
        ai_reasoning: '',
        matched_rule_id: null,
      };

      // Step 1: Try to match with existing rules
      const matchedRule = rules?.find(rule => {
        const pattern = rule.pattern.toLowerCase();
        const desc = tx.description.toLowerCase();
        
        switch (rule.pattern_type) {
          case 'exact':
            return desc === pattern;
          case 'starts_with':
            return desc.startsWith(pattern);
          case 'regex':
            try {
              return new RegExp(pattern).test(desc);
            } catch {
              return false;
            }
          case 'contains':
          default:
            return desc.includes(pattern);
        }
      });

      if (matchedRule && matchedRule.confidence >= 0.7) {
        classification = {
          ...classification,
          suggested_category_id: matchedRule.category_id,
          suggested_category_name: matchedRule.category?.name || null,
          suggested_description: matchedRule.suggested_description || tx.description,
          ai_confidence: matchedRule.confidence,
          ai_reasoning: `Matched rule: "${matchedRule.pattern}" (${Math.round(matchedRule.confidence * 100)}% confidence)`,
          matched_rule_id: matchedRule.id,
        };
      } else if (lovableApiKey) {
        // Step 2: Use AI for classification
        try {
          const categoryList = categories?.map(c => `- ${c.name} (${c.category_type})`).join('\n') || 'Nenhuma categoria cadastrada';
          const clientList = clients?.slice(0, 50).map(c => `- ${c.full_name}${c.company_name ? ` / ${c.company_name}` : ''}`).join('\n') || 'Nenhum cliente cadastrado';

          const prompt = `Você é um assistente financeiro especializado em classificar transações bancárias brasileiras.

TRANSAÇÃO:
- Descrição: ${tx.description}
- Valor: R$ ${Math.abs(tx.amount).toFixed(2)}
- Tipo: ${tx.type === 'credit' ? 'Crédito (entrada)' : 'Débito (saída)'}
- Data: ${tx.date}

CATEGORIAS DISPONÍVEIS:
${categoryList}

CLIENTES CADASTRADOS (primeiros 50):
${clientList}

TAREFA:
1. Sugira a categoria mais apropriada da lista acima
2. Se identificar um cliente relacionado, indique qual
3. Sugira uma descrição mais clara e padronizada
4. Explique brevemente seu raciocínio`;

          const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${lovableApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
              messages: [
                { role: 'system', content: 'Você é um assistente financeiro que classifica transações bancárias. Seja conciso e preciso.' },
                { role: 'user', content: prompt }
              ],
              tools: [{
                type: 'function',
                function: {
                  name: 'classify_transaction',
                  description: 'Classifica uma transação bancária',
                  parameters: {
                    type: 'object',
                    properties: {
                      suggested_category: {
                        type: 'string',
                        description: 'Nome exato da categoria sugerida da lista fornecida'
                      },
                      suggested_client: {
                        type: 'string',
                        description: 'Nome do cliente relacionado, se identificado'
                      },
                      suggested_description: {
                        type: 'string',
                        description: 'Descrição padronizada e clara para a transação'
                      },
                      confidence: {
                        type: 'number',
                        description: 'Nível de confiança de 0 a 1'
                      },
                      reasoning: {
                        type: 'string',
                        description: 'Explicação breve do raciocínio'
                      }
                    },
                    required: ['suggested_category', 'suggested_description', 'confidence', 'reasoning']
                  }
                }
              }],
              tool_choice: { type: 'function', function: { name: 'classify_transaction' } }
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
            
            if (toolCall?.function?.arguments) {
              const args = JSON.parse(toolCall.function.arguments);
              
              // Find matching category
              const matchedCategory = categories?.find(c => 
                c.name.toLowerCase() === args.suggested_category?.toLowerCase()
              );
              
              // Find matching client
              const matchedClient = clients?.find(c => 
                c.full_name.toLowerCase().includes(args.suggested_client?.toLowerCase() || '') ||
                c.company_name?.toLowerCase().includes(args.suggested_client?.toLowerCase() || '')
              );

              classification = {
                ...classification,
                suggested_category_id: matchedCategory?.id || null,
                suggested_category_name: args.suggested_category || null,
                suggested_client_id: matchedClient?.id || null,
                suggested_client_name: args.suggested_client || null,
                suggested_description: args.suggested_description || tx.description,
                ai_confidence: args.confidence || 0.5,
                ai_reasoning: args.reasoning || 'Classificado por IA',
              };
            }
          } else {
            console.error('AI classification failed:', await aiResponse.text());
            classification.ai_reasoning = 'Erro na classificação por IA - usando descrição original';
            classification.ai_confidence = 0.3;
          }
        } catch (aiError) {
          console.error('AI error:', aiError);
          classification.ai_reasoning = 'Erro ao processar IA';
          classification.ai_confidence = 0.3;
        }
      } else {
        classification.ai_reasoning = 'IA não disponível - classificação manual necessária';
        classification.ai_confidence = 0.3;
      }

      results.push(classification);

      // Prepare for insertion into pending_classifications
      pendingInserts.push({
        account_id,
        bank_account_id,
        original_description: tx.description,
        suggested_description: classification.suggested_description,
        amount: Math.abs(tx.amount),
        transaction_date: tx.date,
        transaction_type: tx.type,
        external_id: tx.external_id,
        suggested_category_id: classification.suggested_category_id,
        suggested_client_id: classification.suggested_client_id,
        ai_confidence: classification.ai_confidence,
        ai_reasoning: classification.ai_reasoning,
        matched_rule_id: classification.matched_rule_id,
        status: 'pending',
      });
    }

    // Insert all pending classifications
    if (pendingInserts.length > 0) {
      const { error: insertError } = await supabase
        .from('financial_pending_classifications')
        .insert(pendingInserts);

      if (insertError) {
        console.error('Error inserting pending classifications:', insertError);
      }
    }

    console.log(`Classified ${results.length} transactions`);

    return new Response(JSON.stringify({
      success: true,
      classified: results.length,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Classification error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
