// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("approval transfers only the requested deal, preserving the lead and sibling deal owners", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE users(id uuid, name text, account_id uuid, auth_user_id uuid);
      CREATE TABLE leads(id uuid, responsible_user_id uuid);
      CREATE TABLE deals(id uuid, lead_id uuid, account_id uuid, title text, responsible_user_id uuid, updated_at timestamptz);
      CREATE TABLE deal_transfer_requests(id uuid, deal_id uuid, account_id uuid, requester_id uuid, status text, decided_by uuid, decided_at timestamptz, decision_note text);
      CREATE TABLE deal_activities(account_id uuid, deal_id uuid, type text, title text, content text, old_value text, new_value text, user_id uuid);
      CREATE TABLE notifications(account_id uuid, user_id uuid, type text, title text, content text, link text, source_type text, source_id uuid, triggered_by_user_id uuid, sector_id text);
      CREATE FUNCTION can_manage_spiff_payments(uuid) RETURNS boolean LANGUAGE sql AS 'SELECT true';
    `);
    const sql = readFileSync("drizzle/migrations/0039_deal_transfer_whatsapp.sql", "utf8");
    await db.exec(sql.slice(sql.indexOf("CREATE OR REPLACE FUNCTION public.decide_deal_transfer_core"), sql.indexOf("REVOKE ALL ON FUNCTION public.decide_deal_transfer_core")));
    const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
    await db.query("INSERT INTO users VALUES ($1,'Jonathan',$3,$1),($2,'Darlan',$3,$2)", [id(1), id(2), id(3)]);
    await db.query("INSERT INTO leads VALUES ($1,$2)", [id(4), id(1)]);
    await db.query("INSERT INTO deals VALUES ($1,$3,$4,'Requested',$5,now()),($2,$3,$4,'Sibling',$5,now())", [id(5), id(6), id(4), id(3), id(1)]);
    await db.query("INSERT INTO deal_transfer_requests(id,deal_id,account_id,requester_id,status) VALUES ($1,$2,$3,$4,'pending')", [id(7), id(5), id(3), id(2)]);
    await db.query("SELECT decide_deal_transfer_core($1,$2,true,null)", [id(7), id(1)]);
    expect((await db.query("SELECT responsible_user_id FROM deals WHERE id=$1", [id(5)])).rows[0]).toEqual({ responsible_user_id: id(2) });
    expect((await db.query("SELECT responsible_user_id FROM leads WHERE id=$1", [id(4)])).rows[0]).toEqual({ responsible_user_id: id(1) });
    expect((await db.query("SELECT responsible_user_id FROM deals WHERE id=$1", [id(6)])).rows[0]).toEqual({ responsible_user_id: id(1) });
  } finally { await db.close(); }
}, 20000);