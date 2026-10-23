// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { expect, it } from 'vitest';

// Run the actual webhook against an in-memory query client, never production data.
async function runWebhook(deals: Record<string, any>[], repeats = 1) {
  const store: Record<string, Record<string, any>[]> = {
    deals, leads: [{ id: 'lead', account_id: 'acc', full_name: 'TESTE QA', email: 'qa@example.test', phone: '+5511999999999', instagram: null }],
    typeform_forms: [{ title: '[TRAF-AMP-EC] Teste', account_id: 'acc', form_id: 'form' }],
    pipelines: [{ id: 'pipe', account_id: 'acc', name: 'Closer' }],
    deal_stages: [{ id: 'stage', pipeline_id: 'pipe', display_order: 0 }],
    custom_fields: [], deal_activities: [], typeform_responses: [], lead_field_values: [], deal_field_values: [],
  };
  let serial = 0;
  const client = { from(table: string) {
    let mode = 'select', payload: any, single = false;
    const filters: Array<(row: any) => boolean> = [];
    let limit = Infinity;
    const q: any = {
      select: () => q,
      eq: (k: string, v: any) => { filters.push(r => r[k] === v); return q; },
      is: (k: string, v: any) => { filters.push(r => (r[k] ?? null) === v); return q; },
      in: (k: string, v: any[]) => { filters.push(r => v.includes(r[k])); return q; },
      ilike: (k: string, v: string) => { filters.push(r => String(r[k] ?? '').toLowerCase().includes(v.replace(/%/g, '').toLowerCase())); return q; },
      not: (k: string) => { filters.push(r => r[k] != null); return q; },
      or: () => { filters.push(r => !r.instagram); return q; },
      order: () => q,
      limit: (n: number) => { limit = n; return q; },
      maybeSingle: () => { single = true; return q; },
      single: () => { single = true; return q; },
      insert: (p: any) => { mode = 'insert'; payload = p; return q; },
      upsert: (p: any) => { mode = 'upsert'; payload = p; return q; },
      update: (p: any) => { mode = 'update'; payload = p; return q; },
      delete: () => { mode = 'delete'; return q; },
      then(resolve: any) {
        let rows = (store[table] ?? []).filter(r => filters.every(f => f(r))).slice(0, limit);
        if (mode === 'insert') {
          rows = [{ id: `new-${++serial}`, deleted_at: null, ...payload }];
          (store[table] ??= []).push(...rows);
        } else if (mode === 'upsert') {
          const old = store[table].find(r => r.response_id === payload.response_id);
          if (old) Object.assign(old, payload);
          else store[table].push({ ...payload });
        } else if (mode === 'update') rows.forEach(r => Object.assign(r, payload));
        else if (mode === 'delete') store[table] = store[table].filter(r => !rows.includes(r));
        return Promise.resolve({ data: single ? rows[0] ?? null : rows, error: null }).then(resolve);
      },
    };
    return q;
  } };
  let handler: ((req: Request) => Promise<Response>) | undefined;
  const source = readFileSync('supabase/functions/typeform-webhook/index.ts', 'utf8').replace(/^import .*;\n/gm, '');
  runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText, {
    Deno: { env: { get: () => undefined }, serve: (fn: typeof handler) => { handler = fn; } },
    createClient: () => client, canonicalEmail: (v: any) => v, canonicalE164: (v: any) => v,
    phoneVariants: (v: any) => [v], phoneCoreKey: (v: any) => v,
    createLeadCore: () => { throw new Error('Existing lead must not be duplicated'); },
    URL, Response, console,
  });
  if (!handler) throw new Error('Webhook handler not registered');
  for (let i = 0; i < repeats; i++) {
    await handler(new Request('https://example.test?account_id=acc', { method: 'POST', body: JSON.stringify({ form_response: {
      form_id: 'form', token: 'response', submitted_at: '2026-10-23T21:52:40Z', answers: [
        { type: 'text', text: 'TESTE QA', field: { title: 'Nome' } },
        { type: 'text', text: '@testeqa', field: { title: 'Instagram' } },
        { type: 'email', email: 'qa@example.test' },
        { type: 'choice', choice: { label: 'Acima de 100 mil reais' }, field: { title: 'Faturamento' } },
      ],
    } }) }));
  }
  return store;
}

it('an excluded open-status deal cannot block a new deal or receive fields/notes', async () => {
  const old = { id: 'deleted', account_id: 'acc', lead_id: 'lead', status: 'open', deleted_at: '2026-07-14' };
  const result = await runWebhook([old]);
  expect(result.deals).toHaveLength(2);
  const newDeal = result.deals.find(d => d.id !== 'deleted');
  expect(newDeal?.title).toBe('[TRAF-AMP-EC] TESTE QA');
  expect(newDeal?.pipeline_id).toBe('pipe');
  expect(result.typeform_responses[0]?.matched_deal_id).toBe(newDeal?.id);
  expect(result.deal_field_values.every(v => v.deal_id === newDeal?.id)).toBe(true);
  expect(result.deal_activities[0]?.deal_id).toBe(newDeal?.id);
  expect(old.deleted_at).toBe('2026-07-14');
  expect(result.leads[0]?.instagram).toBe('@testeqa');
});

it('reuses a non-excluded open deal and links the response even on replay', async () => {
  const result = await runWebhook([{ id: 'open', account_id: 'acc', lead_id: 'lead', status: 'open', deleted_at: null }], 2);
  expect(result.deals).toHaveLength(1);
  expect(result.typeform_responses[0]?.matched_deal_id).toBe('open');
  expect(result.deal_activities).toHaveLength(1);
});