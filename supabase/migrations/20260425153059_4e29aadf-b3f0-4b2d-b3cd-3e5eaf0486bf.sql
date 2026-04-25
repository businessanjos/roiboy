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
  v_max_passes int := 8;
  v_pass int := 0;
  v_remaining_tables text[];
  v_total_deleted_in_pass bigint;
BEGIN
  -- Safety: only super_admins can call this
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only super admins can delete accounts';
  END IF;

  -- Collect auth_user_ids of users in this account
  SELECT COALESCE(array_agg(auth_user_id) FILTER (WHERE auth_user_id IS NOT NULL), '{}')
  INTO v_auth_user_ids
  FROM public.users WHERE account_id = p_account_id;

  -- Build list of all tables in public schema that have an account_id column (except 'accounts')
  SELECT array_agg(c.table_name)
  INTO v_remaining_tables
  FROM information_schema.columns c
  JOIN information_schema.tables t
    ON t.table_schema = c.table_schema AND t.table_name = c.table_name
  WHERE c.table_schema = 'public'
    AND c.column_name = 'account_id'
    AND t.table_type = 'BASE TABLE'
    AND c.table_name <> 'accounts';

  -- Repeatedly attempt deletes; tables that succeed are removed from the list.
  -- This handles foreign key ordering between child tables without requiring superuser.
  WHILE v_pass < v_max_passes AND array_length(v_remaining_tables, 1) > 0 LOOP
    v_pass := v_pass + 1;
    v_total_deleted_in_pass := 0;

    FOR v_table IN SELECT unnest(v_remaining_tables) AS table_name LOOP
      BEGIN
        EXECUTE format('DELETE FROM public.%I WHERE account_id = $1', v_table.table_name)
          USING p_account_id;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        IF v_count > 0 THEN
          v_deleted_counts := v_deleted_counts ||
            jsonb_build_object(v_table.table_name,
              COALESCE((v_deleted_counts->>v_table.table_name)::bigint, 0) + v_count);
          v_total_deleted_in_pass := v_total_deleted_in_pass + v_count;
        END IF;
        -- Successfully deleted (even if 0 rows) — remove from remaining list
        v_remaining_tables := array_remove(v_remaining_tables, v_table.table_name);
      EXCEPTION WHEN foreign_key_violation THEN
        -- Keep this table for the next pass
        NULL;
      END;
    END LOOP;

    -- If a full pass deleted nothing and tables still remain, break to avoid infinite loop
    EXIT WHEN v_total_deleted_in_pass = 0 AND array_length(v_remaining_tables, 1) > 0 AND v_pass > 1;
  END LOOP;

  -- Final attempt: any remaining tables — let the error surface for visibility
  IF array_length(v_remaining_tables, 1) > 0 THEN
    FOREACH v_table.table_name IN ARRAY v_remaining_tables LOOP
      EXECUTE format('DELETE FROM public.%I WHERE account_id = $1', v_table.table_name)
        USING p_account_id;
      GET DIAGNOSTICS v_count = ROW_COUNT;
      IF v_count > 0 THEN
        v_deleted_counts := v_deleted_counts ||
          jsonb_build_object(v_table.table_name,
            COALESCE((v_deleted_counts->>v_table.table_name)::bigint, 0) + v_count);
      END IF;
    END LOOP;
  END IF;

  -- Finally delete the account itself
  DELETE FROM public.accounts WHERE id = p_account_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('accounts', v_count);

  -- Remove the orphaned auth.users records
  IF array_length(v_auth_user_ids, 1) > 0 THEN
    DELETE FROM auth.users WHERE id = ANY(v_auth_user_ids);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'account_id', p_account_id,
    'passes', v_pass,
    'deleted', v_deleted_counts
  );
END;
$$;