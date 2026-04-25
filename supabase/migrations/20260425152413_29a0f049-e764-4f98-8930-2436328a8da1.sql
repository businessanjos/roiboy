-- Function to delete an account and ALL its related data in cascade
-- This bypasses FK constraints by deleting child records first in a transaction
CREATE OR REPLACE FUNCTION public.delete_account_cascade(p_account_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table record;
  v_deleted_counts jsonb := '{}'::jsonb;
  v_count bigint;
  v_auth_user_ids uuid[];
BEGIN
  -- Safety: only super_admins can call this
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only super admins can delete accounts';
  END IF;

  -- Collect auth_user_ids of users in this account so we can remove them from auth.users at the end
  SELECT COALESCE(array_agg(auth_user_id) FILTER (WHERE auth_user_id IS NOT NULL), '{}')
  INTO v_auth_user_ids
  FROM public.users WHERE account_id = p_account_id;

  -- Iterate through every table in public schema that has an account_id column
  -- and delete rows belonging to this account. Order doesn't matter inside the
  -- function because we disable triggers via session_replication_role.
  PERFORM set_config('session_replication_role', 'replica', true);

  FOR v_table IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'account_id'
      AND t.table_type = 'BASE TABLE'
      AND c.table_name <> 'accounts'
  LOOP
    EXECUTE format('DELETE FROM public.%I WHERE account_id = $1', v_table.table_name)
      USING p_account_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN
      v_deleted_counts := v_deleted_counts || jsonb_build_object(v_table.table_name, v_count);
    END IF;
  END LOOP;

  -- Finally delete the account itself
  DELETE FROM public.accounts WHERE id = p_account_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('accounts', v_count);

  PERFORM set_config('session_replication_role', 'origin', true);

  -- Remove the orphaned auth.users records
  IF array_length(v_auth_user_ids, 1) > 0 THEN
    DELETE FROM auth.users WHERE id = ANY(v_auth_user_ids);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'account_id', p_account_id,
    'deleted', v_deleted_counts
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_account_cascade(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_account_cascade(uuid) TO authenticated;