import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "criar_marco",
      description: "Cria um marco no projeto. SEMPRE escolha uma das 6 fases do roadmap: discovery (descoberta/pesquisa/objetivos), planning (estratégia/cronograma/briefing), pre_production (fornecedores/contratos/setup), production (execução/criação das entregas), launch (go-live/mídia/evento), post_launch (resultados/retrospectiva/relatórios).",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string", description: "Detalhe entregas, critérios de aceite e dependências" },
          start_date: { type: "string", description: "YYYY-MM-DD" },
          due_date: { type: "string", description: "YYYY-MM-DD" },
          phase: { type: "string", enum: ["discovery", "planning", "pre_production", "production", "launch", "post_launch"] },
          priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
          owner: { type: "string", description: "Nome do responsável" },
        },
        required: ["title", "phase"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_tarefa",
      description: "Cria uma tarefa de marketing e vincula ao projeto.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          due_date: { type: "string", description: "YYYY-MM-DD" },
          priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_documento",
      description: "Adiciona um link/documento ao projeto (brief, drive, contrato, deck, etc.).",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          url: { type: "string" },
          kind: { type: "string", enum: ["link", "drive", "brief", "contract", "deck", "other"] },
        },
        required: ["title", "url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "adicionar_stakeholder_externo",
      description: "Adiciona um stakeholder externo (fornecedor, agência, parceiro) ao projeto.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          role: { type: "string", description: "Ex.: Sponsor, Designer, Editor, Produtor" },
          email: { type: "string" },
          phone: { type: "string" },
        },
        required: ["name", "role"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "atualizar_projeto",
      description: "Atualiza campos do projeto (status, descrição, data alvo, orçamento).",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["planning", "active", "launched", "on_hold", "completed"] },
          description: { type: "string" },
          target_date: { type: "string", description: "YYYY-MM-DD" },
          budget_planned: { type: "number" },
        },
      },
    },
  },
];

async function executeTool(
  supabase: any,
  accountId: string,
  projectId: string,
  userId: string | null,
  name: string,
  args: any,
) {
  try {
    if (name === "criar_marco") {
      const { data, error } = await supabase
        .from("marketing_project_milestones")
        .insert({
          project_id: projectId,
          account_id: accountId,
          title: args.title,
          description: args.description ?? null,
          start_date: args.start_date ?? null,
          due_date: args.due_date ?? null,
          phase: args.phase ?? "planning",
          priority: args.priority ?? "medium",
          owner: args.owner ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return { success: true, milestone_id: data.id, title: data.title, phase: data.phase };
    }
    if (name === "criar_tarefa") {
      const { data: task, error } = await supabase
        .from("marketing_tasks")
        .insert({
          account_id: accountId,
          title: args.title,
          description: args.description ?? null,
          due_date: args.due_date ?? null,
          priority: args.priority || "medium",
          created_by: userId,
        })
        .select()
        .single();
      if (error) throw error;
      const { error: linkErr } = await supabase
        .from("marketing_project_tasks")
        .insert({ project_id: projectId, task_id: task.id, account_id: accountId });
      if (linkErr) throw linkErr;
      return { success: true, task_id: task.id, title: task.title };
    }
    if (name === "criar_documento") {
      const { data, error } = await supabase
        .from("marketing_project_documents")
        .insert({
          project_id: projectId,
          account_id: accountId,
          title: args.title,
          url: args.url,
          kind: args.kind || "link",
          created_by: userId,
        })
        .select()
        .single();
      if (error) throw error;
      return { success: true, document_id: data.id };
    }
    if (name === "adicionar_stakeholder_externo") {
      const { data, error } = await supabase
        .from("marketing_project_stakeholders")
        .insert({
          project_id: projectId,
          account_id: accountId,
          type: "external",
          name: args.name,
          role: args.role,
          email: args.email ?? null,
          phone: args.phone ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return { success: true, stakeholder_id: data.id };
    }
    if (name === "atualizar_projeto") {
      const patch: any = {};
      if (args.status) patch.status = args.status;
      if (args.description !== undefined) patch.description = args.description;
      if (args.target_date !== undefined) patch.target_date = args.target_date;
      if (args.budget_planned !== undefined) patch.budget_planned = args.budget_planned;
      const { error } = await supabase
        .from("marketing_projects")
        .update(patch)
        .eq("id", projectId)
        .eq("account_id", accountId);
      if (error) throw error;
      return { success: true, updated: Object.keys(patch) };
    }
    return { error: "Ferramenta desconhecida" };
  } catch (e: any) {
    return { error: e.message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    const authUserId = userData?.user?.id;
    if (!authUserId) throw new Error("Sessão inválida");

    const { projectId, message, accountId } = await req.json();
    if (!projectId || !message || !accountId) {
      throw new Error("projectId, message, accountId obrigatórios");
    }

    // Resolve users.id from auth_user_id (for created_by audit)
    const { data: userRow } = await supabase
      .from("users")
      .select("id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();
    const internalUserId = userRow?.id ?? null;

    // Project snapshot
    const [{ data: project }, { data: milestones }, { data: stakeholders }, { data: docs }, { data: linkedTasks }, { data: linkedEvents }] =
      await Promise.all([
        supabase.from("marketing_projects").select("*").eq("id", projectId).maybeSingle(),
        supabase.from("marketing_project_milestones").select("title, due_date, completed").eq("project_id", projectId).order("display_order"),
        supabase.from("marketing_project_stakeholders").select("name, role, type, user_id").eq("project_id", projectId),
        supabase.from("marketing_project_documents").select("title, kind, url").eq("project_id", projectId),
        supabase.from("marketing_project_tasks").select("task_id, marketing_tasks(title, status, priority, due_date)").eq("project_id", projectId),
        supabase.from("marketing_project_events" as any).select("event_id, events(title, scheduled_at)").eq("project_id", projectId),
      ]);

    if (!project) throw new Error("Projeto não encontrado");

    // Save user message
    await supabase.from("marketing_project_copilot_messages").insert({
      project_id: projectId,
      account_id: accountId,
      role: "user",
      content: message,
      created_by: internalUserId,
    });

    // Load history
    const { data: history } = await supabase
      .from("marketing_project_copilot_messages")
      .select("role, content, tool_calls, tool_call_id, tool_name, tool_result")
      .eq("project_id", projectId)
      .order("created_at")
      .limit(80);

    const fmtList = (arr: any[] | null, fn: (i: any) => string) =>
      arr?.length ? arr.map(fn).filter(Boolean).join(" | ") : "nenhum";

    const systemPrompt = `Você é o **Copilot IA de Projetos de Marketing** — estrategista sênior em lançamentos, eventos internacionais e grandes iniciativas para o mercado de estética avançada. Atua como project manager, copywriter, planner e produtor.

REGRAS:
- Português brasileiro, direto, profissional, com markdown (negrito, listas, emojis com moderação).
- Quando o usuário pedir pra "criar", "adicionar", "registrar", "agendar" algo no projeto, USE as ferramentas — não apenas sugira.
- Ao propor um plano de marcos/tarefas, ofereça criar de uma vez (chame várias ferramentas em sequência).
- Datas: assuma fuso BRT, formato YYYY-MM-DD. Hoje: ${new Date().toISOString().slice(0, 10)}.
- Sempre pense como project manager: defina dependências, riscos, próximos passos.

PROJETO ATUAL:
- **Nome**: ${project.name}
- **Status**: ${project.status}
- **Data alvo**: ${project.target_date || "—"}
- **Orçamento planejado**: ${project.budget_planned ? `R$ ${project.budget_planned}` : "—"}
- **Descrição**: ${project.description || "—"}

ESTADO ATUAL:
- **Marcos** (${milestones?.length || 0}): ${fmtList(milestones, (m) => `${m.completed ? "✅" : "⏳"} ${m.title}${m.due_date ? ` (${m.due_date})` : ""}`)}
- **Stakeholders** (${stakeholders?.length || 0}): ${fmtList(stakeholders, (s) => `${s.name || "Interno"} — ${s.role}`)}
- **Documentos** (${docs?.length || 0}): ${fmtList(docs, (d) => `[${d.kind}] ${d.title}`)}
- **Tarefas vinculadas** (${linkedTasks?.length || 0}): ${fmtList(linkedTasks, (t: any) => t.marketing_tasks?.title)}
- **Eventos vinculados** (${linkedEvents?.length || 0}): ${fmtList(linkedEvents, (e: any) => e.events?.title)}`;

    const messages: any[] = [
      { role: "system", content: systemPrompt },
      ...(history || []).slice(0, -1).map((m: any) => {
        if (m.role === "tool") {
          return { role: "tool", tool_call_id: m.tool_call_id, name: m.tool_name, content: JSON.stringify(m.tool_result) };
        }
        if (m.role === "assistant" && m.tool_calls) {
          return { role: "assistant", content: m.content || "", tool_calls: m.tool_calls };
        }
        return { role: m.role, content: m.content };
      }),
      { role: "user", content: message },
    ];

    let iter = 0;
    let finalText = "";
    const executedTools: any[] = [];

    while (iter < 6) {
      iter++;
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages,
          tools: TOOLS,
        }),
      });

      if (!res.ok) {
        const t = await res.text();
        if (res.status === 429) {
          return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em 1 minuto." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (res.status === 402) {
          return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione saldo em Workspace > Usage." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(`AI ${res.status}: ${t}`);
      }

      const data = await res.json();
      const msg = data.choices[0].message;

      if (msg.tool_calls?.length) {
        await supabase.from("marketing_project_copilot_messages").insert({
          project_id: projectId, account_id: accountId,
          role: "assistant", content: msg.content || "", tool_calls: msg.tool_calls,
        });

        messages.push({ role: "assistant", content: msg.content || "", tool_calls: msg.tool_calls });

        for (const tc of msg.tool_calls) {
          const args = JSON.parse(tc.function.arguments || "{}");
          const result = await executeTool(supabase, accountId, projectId, internalUserId, tc.function.name, args);
          executedTools.push({ name: tc.function.name, args, result });

          await supabase.from("marketing_project_copilot_messages").insert({
            project_id: projectId, account_id: accountId,
            role: "tool", tool_call_id: tc.id, tool_name: tc.function.name, tool_result: result,
          });

          messages.push({ role: "tool", tool_call_id: tc.id, name: tc.function.name, content: JSON.stringify(result) });
        }
        continue;
      }

      finalText = msg.content || "";
      await supabase.from("marketing_project_copilot_messages").insert({
        project_id: projectId, account_id: accountId,
        role: "assistant", content: finalText,
      });
      break;
    }

    return new Response(JSON.stringify({ reply: finalText, executedTools }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("project-copilot error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
