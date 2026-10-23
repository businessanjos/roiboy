DO $do$
DECLARE d text; s int; e int; lat text;
BEGIN
  d := pg_get_functiondef('public.zapp_productivity_metrics'::regproc);
  s := position('    LEFT JOIN LATERAL (SELECT public.zapp_infer_sender(d.cid' in d);
  e := position(') inf ON true' in d);
  IF s = 0 OR e = 0 THEN RAISE EXCEPTION 'metrics lateral not found'; END IF;
  d := substr(d, 1, s - 1) || substr(d, e + length(') inf ON true') + 1);
  -- dedup1 computes inferred user via CASE; then dedup reads from it
  d := replace(d, E'  dedup AS (\n    SELECT d.id, d.cid, d.direction, d.sent_at,',
    E'  dedup1 AS (\n    SELECT d.*, su.id AS sig_uid,\n      CASE WHEN d.direction = ''outbound'' AND d.sender_user_id IS NULL AND su.id IS NULL AND NOT d.from_history AND coalesce(d.sender_name,'''') NOT ILIKE ''canal%'' AND coalesce(d.sender_name,'''') NOT ILIKE ''%automa%'' AND d.sig IS NULL AND d.sent_at >= (_from - interval ''48 hours'')\n           THEN public.zapp_infer_sender(d.cid, d.sent_at) END AS inf_uid\n    FROM dedup0 d LEFT JOIN sig_users su ON su.key = d.sig\n  ),\n  dedup AS (\n    SELECT d.id, d.cid, d.direction, d.sent_at,');
  d := replace(d, 'coalesce(d.sender_user_id, su.id, inf.uid)', 'coalesce(d.sender_user_id, d.sig_uid, d.inf_uid)');
  d := replace(d, E'    FROM dedup0 d\n    LEFT JOIN sig_users su ON su.key = d.sig\n  ),\n  dupes', E'    FROM dedup1 d\n  ),\n  dupes');
  IF position('FROM dedup1 d' in d) = 0 OR position('inf.uid' in d) > 0 THEN RAISE EXCEPTION 'metrics rewrite failed'; END IF;
  EXECUTE d;
END
$do$;