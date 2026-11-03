// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, expect, it } from 'vitest';
let db: PGlite;
const deal = '00000000-0000-0000-0000-000000000001';
const acc = '00000000-0000-0000-0000-000000000002';
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE deals(id uuid PRIMARY KEY,previous_lost_deal_id uuid,account_id uuid,created_at timestamptz,deleted_at timestamptz,status text,stage_id text,responsible_user_id text);
    CREATE TABLE typeform_responses(id text PRIMARY KEY,account_id uuid,matched_deal_id uuid,submitted_at timestamptz,is_completed boolean);
    INSERT INTO deals(id,previous_lost_deal_id,account_id,created_at,deleted_at,status,stage_id,responsible_user_id) VALUES('${deal}',null,'${acc}','2026-10-23T20:00:00Z',null,'open','original-stage','original-owner');`);
  await db.exec(readFileSync('drizzle/migrations/0036_deal_typeform_reapplications.sql','utf8'));
},20000);
afterAll(async () => { await db.close(); });
const state = async () => (await db.query<{typeform_reapplication_count:number;typeform_last_reapplication_at:string}>('SELECT * FROM deals')).rows[0];
it('flags a new application to an existing deal without changing its owner or stage',async () => {
  await db.query('INSERT INTO typeform_responses VALUES($1,$2,$3,$4,true)',['new',acc,deal,'2026-10-23T21:00:00Z']);
  expect(await state()).toMatchObject({typeform_reapplication_count:1,stage_id:'original-stage',responsible_user_id:'original-owner'});
});
it('does not count a replay twice, but counts another completed application',async () => {
  await db.exec("UPDATE typeform_responses SET matched_deal_id=matched_deal_id WHERE id='new'");
  expect((await state())?.typeform_reapplication_count).toBe(1);
  await db.query('INSERT INTO typeform_responses VALUES($1,$2,$3,$4,true)',['second',acc,deal,'2026-10-23T22:00:00Z']);
  expect((await state())?.typeform_reapplication_count).toBe(2);
  expect(new Date(String((await state())?.typeform_last_reapplication_at)).toISOString()).toBe('2026-10-23T22:00:00.000Z');
});
it('does not count the initial application, incomplete submissions or another account',async () => {
  await db.query('INSERT INTO typeform_responses VALUES($1,$2,$3,$4,true)',['initial',acc,deal,'2026-10-23T19:59:00Z']);
  await db.query('INSERT INTO typeform_responses VALUES($1,$2,$3,$4,false)',['partial',acc,deal,'2026-10-23T23:00:00Z']);
  await db.query('INSERT INTO typeform_responses VALUES($1,$2,$3,$4,true)',['other','00000000-0000-0000-0000-000000000003',deal,'2026-10-23T23:00:00Z']);
  expect((await state())?.typeform_reapplication_count).toBe(2);
});it('flags a new deal opened after a loss, counting the application that opened it', async () => {
  const fresh = '00000000-0000-0000-0000-000000000009';
  await db.exec(`ALTER TABLE deals ADD COLUMN IF NOT EXISTS previous_lost_deal_id uuid;`);
  await db.exec(readFileSync('drizzle/migrations/0050_deal_reapplied_after_loss.sql','utf8'));
  await db.query(`INSERT INTO deals(id,account_id,created_at,status,previous_lost_deal_id) VALUES($1,$2,'2026-11-03T10:00:01Z','open',$3)`,[fresh,acc,deal]);
  await db.query('INSERT INTO typeform_responses VALUES($1,$2,$3,$4,true)',['reopen',acc,fresh,'2026-11-03T10:00:00Z']);
  const r = (await db.query<{typeform_reapplication_count:number}>('SELECT typeform_reapplication_count FROM deals WHERE id=$1',[fresh])).rows[0];
  expect(r.typeform_reapplication_count).toBe(1);
});
