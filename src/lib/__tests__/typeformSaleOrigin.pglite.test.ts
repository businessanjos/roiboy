// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, expect, it } from 'vitest';

const account = '00000000-0000-0000-0000-000000000001';
const other = '00000000-0000-0000-0000-000000000002';
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE custom_fields (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid,
      name text, field_type text DEFAULT 'multi_select', show_in_deals boolean DEFAULT true,
      is_active boolean DEFAULT true, options jsonb DEFAULT '[]', updated_at timestamptz);
    CREATE TABLE typeform_forms (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid,
      title text, is_active boolean DEFAULT true);
  `);
  await db.exec(readFileSync('drizzle/migrations/0035_typeform_auto_sale_origin.sql', 'utf8'));
  for (const a of [account, other]) {
    await db.query(`INSERT INTO custom_fields (account_id,name,options) VALUES ($1,'Origem da Venda',$2)`,
      [a, JSON.stringify([{ label: '[TRAF-STUDIO-EC]', value: 'existing_id', color: 'pink' }])]);
  }
}, 20000);
afterAll(async () => { await db.close(); });

const options = async (a = account) => {
  const result = await db.query<{ options: Array<{label: string; value: string; color: string}> }>(
    'SELECT options FROM custom_fields WHERE account_id=$1', [a]);
  return result.rows[0]?.options ?? [];
};

it('creates [TRAF-AMP-EC] on registration while preserving existing origins and account isolation', async () => {
  await db.query('INSERT INTO typeform_forms(account_id,title) VALUES ($1,$2)',
    [account, '[TRAF-AMP-EC] [EMBED] Funil Eternum Club']);
  expect(await options()).toEqual([
    { label: '[TRAF-STUDIO-EC]', value: 'existing_id', color: 'pink' },
    { label: '[TRAF-AMP-EC]', value: expect.stringMatching(/^opt_/), color: 'blue' },
  ]);
  expect(await options(other)).toEqual([{ label: '[TRAF-STUDIO-EC]', value: 'existing_id', color: 'pink' }]);
});

it('does not duplicate an origin when registering another form or synchronizing its title', async () => {
  const before = await options();
  await db.query('INSERT INTO typeform_forms(account_id,title) VALUES ($1,$2)',
    [account, '[TRAF-AMP-EC] Outro formulário']);
  await db.query('UPDATE typeform_forms SET title=title WHERE account_id=$1', [account]);
  expect(await options()).toEqual(before);
});

it('creates the new tag on title sync without removing older option IDs', async () => {
  await db.query('UPDATE typeform_forms SET title=$1 WHERE account_id=$2', ['[ORG-NOVO] Novo título', account]);
  const result = await options();
  expect(result.filter(o => o.label === '[ORG-NOVO]')).toHaveLength(1);
  expect(result.find(o => o.label === '[TRAF-STUDIO-EC]')?.value).toBe('existing_id');
  expect(result.some(o => o.label === '[TRAF-AMP-EC]')).toBe(true);
});

it('ignores inactive forms and titles without a campaign tag', async () => {
  const before = await options();
  await db.query('INSERT INTO typeform_forms(account_id,title,is_active) VALUES ($1,$2,false),($1,$3,true)',
    [account, '[TRAF-INATIVO] Inativo', 'Sem identificação']);
  expect(await options()).toEqual(before);
  await db.query('UPDATE typeform_forms SET is_active=true WHERE title=$1', ['[TRAF-INATIVO] Inativo']);
  expect((await options()).filter(o => o.label === '[TRAF-INATIVO]')).toHaveLength(1);
});