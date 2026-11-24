// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, beforeEach, afterAll, expect, it } from 'vitest';

const account = '00000000-0000-0000-0000-000000000001';
const otherAccount = '00000000-0000-0000-0000-000000000002';
const profile = '00000000-0000-0000-0000-000000000010';
const foreignProfile = '00000000-0000-0000-0000-000000000020';
let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE service_role; CREATE ROLE anon;
    CREATE TABLE instagram_profiles(id uuid PRIMARY KEY, account_id uuid);
    GRANT SELECT ON instagram_profiles TO authenticated;
    CREATE FUNCTION get_current_user_account_id() RETURNS uuid LANGUAGE sql STABLE
      AS $$ SELECT current_setting('app.account_id')::uuid $$;
    CREATE TABLE instagram_story_link_clicks(id uuid DEFAULT gen_random_uuid(), description text, link_clicks integer);
    INSERT INTO instagram_story_link_clicks(description,link_clicks) VALUES ('TESTE QA Story existente',30);
  `);
  await db.exec(readFileSync('drizzle/migrations/0100_instagram_feed_link_clicks.sql', 'utf8'));
  await db.query('INSERT INTO instagram_profiles VALUES ($1,$2),($3,$4)', [profile, account, foreignProfile, otherAccount]);
}, 20000);

beforeEach(async () => {
  await db.exec('RESET ROLE; DELETE FROM instagram_feed_link_clicks;');
  await db.query("SELECT set_config('app.account_id',$1,false)", [account]);
});
afterAll(async () => { await db.close(); });

it('mantém o Story anterior ao registrar um Feed e permite reler o Feed pela própria conta', async () => {
  await db.exec('SET ROLE authenticated;');
  await db.query("INSERT INTO instagram_feed_link_clicks(account_id,profile_id,post_date,description,views,link_clicks) VALUES($1,$2,'2026-11-24','TESTE QA Feed',2000,50)", [account, profile]);
  expect((await db.query('SELECT views,link_clicks FROM instagram_feed_link_clicks')).rows).toEqual([{ views: 2000, link_clicks: 50 }]);
  await db.exec('RESET ROLE;');
  expect((await db.query('SELECT description,link_clicks FROM instagram_story_link_clicks')).rows).toEqual([{ description: 'TESTE QA Story existente', link_clicks: 30 }]);
});

it('não permite consultar ou inserir Feed de outra conta', async () => {
  await db.query("INSERT INTO instagram_feed_link_clicks(account_id,profile_id,post_date) VALUES($1,$2,'2026-11-24')", [otherAccount, foreignProfile]);
  await db.exec('SET ROLE authenticated;');
  expect((await db.query('SELECT id FROM instagram_feed_link_clicks')).rows).toEqual([]);
  await expect(db.query("INSERT INTO instagram_feed_link_clicks(account_id,profile_id,post_date) VALUES($1,$2,'2026-11-24')", [otherAccount, foreignProfile])).rejects.toThrow(/row-level security/);
});

it('não permite vincular um Feed ao perfil de outra conta', async () => {
  await db.exec('SET ROLE authenticated;');
  await expect(db.query("INSERT INTO instagram_feed_link_clicks(account_id,profile_id,post_date) VALUES($1,$2,'2026-11-24')", [account, foreignProfile])).rejects.toThrow(/row-level security/);
});

it('não concede consulta anônima', async () => {
  await db.exec('SET ROLE anon;');
  await expect(db.query('SELECT id FROM instagram_feed_link_clicks')).rejects.toThrow(/permission denied/);
});