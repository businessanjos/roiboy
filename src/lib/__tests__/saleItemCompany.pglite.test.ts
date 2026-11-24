// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, expect, it } from 'vitest';
import { PRODUCT_IDS } from '@/lib/sales/itemVendaResolver';

const account = '00000000-0000-0000-0000-000000000001';
const otherAccount = '00000000-0000-0000-0000-000000000002';
const eternum = '00000000-0000-0000-0000-000000000010';
const anjos = '00000000-0000-0000-0000-000000000011';
const foreignCompany = '00000000-0000-0000-0000-000000000012';
const field = '033b91fb-3add-4c96-aec9-567fefbd0fb2';
const deal = '00000000-0000-0000-0000-000000000020';
const catalog = [
  { id: PRODUCT_IDS.CLINICA_RYKA, name: 'CR l Programa de Aceleração', company: anjos, slug: 'opt_1787176918301' },
  { id: PRODUCT_IDS.EM, name: 'EM l Eternum Mentoring', company: eternum, slug: 'rykas_mentoring' },
  { id: PRODUCT_IDS.EC, name: 'EC l Eternum Club', company: eternum, slug: 'eternum_club' },
  { id: PRODUCT_IDS.EP, name: 'EP l Eternum Private', company: eternum, slug: 'eternum_private' },
  { id: PRODUCT_IDS.CA, name: 'Conselho de Anjo', company: eternum, slug: 'conselho_anjo' },
];
let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE TABLE companies(id uuid PRIMARY KEY, account_id uuid, trade_name text, is_default boolean, is_active boolean DEFAULT true);
    CREATE TABLE products(id uuid PRIMARY KEY, account_id uuid, name text, company_id uuid REFERENCES companies);
    CREATE TABLE custom_fields(id uuid PRIMARY KEY, account_id uuid, name text, show_in_deals boolean, options jsonb);
    CREATE TABLE deals(id uuid PRIMARY KEY, account_id uuid, company_id uuid, status text DEFAULT 'open', value numeric DEFAULT 35000, responsible_user_id uuid, pipeline_id uuid, stage_id uuid);
    CREATE TABLE deal_field_values(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid, deal_id uuid, field_id uuid, value_text text, UNIQUE(deal_id,field_id));
    GRANT SELECT ON companies, products, custom_fields, deals TO authenticated;
    GRANT UPDATE ON deals TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON deal_field_values TO authenticated;
    ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
    CREATE POLICY own_deal ON deals TO authenticated
      USING (account_id = current_setting('app.account_id')::uuid)
      WITH CHECK (account_id = current_setting('app.account_id')::uuid);
  `);
  await db.exec(readFileSync('drizzle/migrations/0099_sale_item_company_link.sql', 'utf8'));
}, 20000);

beforeEach(async () => {
  await db.exec('RESET ROLE; DELETE FROM deal_field_values; DELETE FROM deals; DELETE FROM products; DELETE FROM custom_fields; DELETE FROM companies;');
  await db.query('INSERT INTO companies VALUES ($1,$2,$3,true,true),($4,$2,$5,false,true),($6,$7,$8,true,true)',
    [eternum, account, 'Eternum', anjos, 'Anjos', foreignCompany, otherAccount, 'Outra conta']);
  for (const product of catalog) {
    await db.query('INSERT INTO products VALUES ($1,$2,$3,$4)', [product.id, account, product.name, product.company]);
  }
  await db.query('INSERT INTO custom_fields VALUES ($1,$2,$3,true,$4)',
    [field, account, 'Item da Venda', JSON.stringify(catalog.map(p => ({value: p.slug, label: p.name})))]);
  await db.query("INSERT INTO deals(id,account_id,company_id,responsible_user_id,pipeline_id,stage_id) VALUES ($1,$2,$3,$2,$2,$2)", [deal, account, eternum]);
});
afterAll(async () => { await db.close(); });

interface SavedDeal {
  id: string;
  account_id: string;
  company_id: string;
  status: string;
  value: number;
  responsible_user_id: string;
  pipeline_id: string;
  stage_id: string;
}
const readDeal = async () => {
  const result = await db.query<SavedDeal>('SELECT * FROM deals WHERE id=$1', [deal]);
  const saved = result.rows[0];
  if (!saved) throw new Error('Negócio de teste não encontrado');
  return saved;
};
const saveItem = async (raw: string, owner = account) => db.query(
  'INSERT INTO deal_field_values(account_id,deal_id,field_id,value_text) VALUES ($1,$2,$3,$4) ON CONFLICT(deal_id,field_id) DO UPDATE SET value_text=EXCLUDED.value_text',
  [owner, deal, field, raw]);

it.each(catalog)('$name: a venda herda a empresa do produto sem alterar o restante do negócio', async (product) => {
  const before = await readDeal();
  await saveItem(product.id);
  expect(await readDeal()).toEqual({...before, company_id: product.company});
});

it.each(catalog)('$name: a opção antiga também herda a empresa correta', async (product) => {
  await saveItem(product.slug);
  expect((await readDeal())?.company_id).toBe(product.company);
});

it('trocar CR por EM atualiza somente o vínculo da empresa', async () => {
  await saveItem(PRODUCT_IDS.CLINICA_RYKA);
  const before = await readDeal();
  await saveItem(PRODUCT_IDS.EM);
  expect(await readDeal()).toEqual({...before, company_id: eternum});
});

it('mudar a empresa do catálogo não reclassifica vendas antigas', async () => {
  await saveItem(PRODUCT_IDS.CLINICA_RYKA);
  await db.query('UPDATE products SET company_id=$1 WHERE id=$2', [eternum, PRODUCT_IDS.CLINICA_RYKA]);
  expect((await readDeal())?.company_id).toBe(anjos);
});

it('campo diferente e produto não resolvido não mudam a empresa', async () => {
  await saveItem(PRODUCT_IDS.CLINICA_RYKA);
  const before = await readDeal();
  await saveItem('produto_desconhecido');
  await db.query('INSERT INTO deal_field_values(account_id,deal_id,field_id,value_text) VALUES ($1,$2,$3,$4)', [account, deal, anjos, PRODUCT_IDS.EM]);
  expect(await readDeal()).toEqual(before);
});

it('remover Item da Venda restaura a empresa padrão', async () => {
  await saveItem(PRODUCT_IDS.CLINICA_RYKA);
  await db.query('DELETE FROM deal_field_values WHERE deal_id=$1 AND field_id=$2', [deal, field]);
  expect((await readDeal())?.company_id).toBe(eternum);
});

it('produto não pode ser vinculado a uma empresa de outra conta', async () => {
  await expect(db.query('UPDATE products SET company_id=$1 WHERE id=$2', [foreignCompany, PRODUCT_IDS.CLINICA_RYKA])).rejects.toThrow('mesma conta');
  expect((await db.query<{ company_id: string }>('SELECT company_id FROM products WHERE id=$1', [PRODUCT_IDS.CLINICA_RYKA])).rows[0]?.company_id).toBe(anjos);
});

it('o vínculo não bypassa a visibilidade RLS dos negócios', async () => {
  await db.query('UPDATE deals SET account_id=$1 WHERE id=$2', [otherAccount, deal]);
  await db.query("SELECT set_config('app.account_id',$1,false)", [account]);
  await db.exec('SET ROLE authenticated');
  await saveItem(PRODUCT_IDS.CLINICA_RYKA);
  await db.exec('RESET ROLE');
  expect((await readDeal())?.company_id).toBe(eternum);
});