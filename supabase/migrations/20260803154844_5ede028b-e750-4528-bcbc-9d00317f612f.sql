CREATE OR REPLACE FUNCTION public.audit_zapp_conversation_routing(
  p_dry_run boolean DEFAULT false,
  p_min_messages integer DEFAULT 5,
  p_min_ratio numeric DEFAULT 0.8,
  p_limit integer DEFAULT 500
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec record;
  v_target_dept uuid;
  v_existing uuid;
  v_fixed integer := 0;
  v_detected integer := 0;
  v_items jsonb := '[]'::jsonb;
  v_action text;
BEGIN
  CREATE TEMP TABLE tmp_prefix_map ON COMMIT DROP AS
  WITH raw AS (
    SELECT split_part(m.external_message_id, ':', 1) AS prefix,
           c.integration_id,
           count(*) AS cnt
    FROM public.zapp_messages m
    JOIN public.zapp_conversations c ON c.id = m.zapp_conversation_id
    WHERE m.external_message_id ~ '^[0-9]{10,15}:'
      AND c.integration_id IS NOT NULL
    GROUP BY 1, 2
  ), ranked AS (
    SELECT prefix, integration_id, cnt,
           row_number() OVER (PARTITION BY prefix ORDER BY cnt DESC) AS rn
    FROM raw
  )
  SELECT prefix, integration_id, cnt FROM ranked WHERE rn = 1;

  FOR v_rec IN
    WITH conv AS (
      SELECT m.zapp_conversation_id AS conversation_id,
             split_part(m.external_message_id, ':', 1) AS prefix,
             count(*) AS cnt
      FROM public.zapp_messages m
      WHERE m.external_message_id ~ '^[0-9]{10,15}:'
      GROUP BY 1, 2
    ), agg AS (
      SELECT conversation_id,
             sum(cnt) AS total_cnt,
             (array_agg(prefix ORDER BY cnt DESC))[1] AS top_prefix,
             (array_agg(cnt ORDER BY cnt DESC))[1] AS top_cnt
      FROM conv
      GROUP BY conversation_id
    )
    SELECT a.conversation_id, a.total_cnt, a.top_prefix, a.top_cnt,
           c.integration_id AS current_integration_id,
           c.sector_id AS current_sector_id,
           c.account_id, c.contact_name, c.phone_e164,
           pm.integration_id AS expected_integration_id,
           i.sector_id AS expected_sector_id,
           i.display_name AS expected_integration_name
    FROM agg a
    JOIN public.zapp_conversations c ON c.id = a.conversation_id
    JOIN tmp_prefix_map pm ON pm.prefix = a.top_prefix
    JOIN public.integrations i ON i.id = pm.integration_id
    WHERE a.total_cnt >= p_min_messages
      AND a.top_cnt::numeric / a.total_cnt::numeric >= p_min_ratio
      AND pm.integration_id IS DISTINCT FROM c.integration_id
    ORDER BY a.total_cnt DESC
    LIMIT p_limit
  LOOP
    v_detected := v_detected + 1;
    v_action := 'detected';

    SELECT id INTO v_target_dept
    FROM public.zapp_departments
    WHERE sector_id = v_rec.expected_sector_id
      AND account_id = v_rec.account_id
    LIMIT 1;

    IF NOT p_dry_run THEN
      UPDATE public.zapp_conversations
      SET integration_id = v_rec.expected_integration_id,
          sector_id = v_rec.expected_sector_id,
          updated_at = now()
      WHERE id = v_rec.conversation_id;

      IF v_target_dept IS NOT NULL THEN
        SELECT a.id INTO v_existing
        FROM public.zapp_conversation_assignments a
        WHERE a.zapp_conversation_id = v_rec.conversation_id
          AND a.department_id = v_target_dept
          AND a.status <> 'closed'
        LIMIT 1;

        IF v_existing IS NOT NULL THEN
          UPDATE public.zapp_conversation_assignments
          SET status = 'closed', closed_at = now(),
              close_notes = coalesce(close_notes, '') ||
                'Encerrado pela auditoria de roteamento: conversa pertence a ' || coalesce(v_rec.expected_integration_name, v_rec.expected_sector_id),
              updated_at = now()
          WHERE zapp_conversation_id = v_rec.conversation_id
            AND department_id IS DISTINCT FROM v_target_dept
            AND status <> 'closed';
          v_action := 'closed_duplicate';
        ELSE
          UPDATE public.zapp_conversation_assignments
          SET department_id = v_target_dept,
              agent_id = NULL,
              status = 'triage',
              updated_at = now()
          WHERE zapp_conversation_id = v_rec.conversation_id
            AND status <> 'closed';
          v_action := 'reassigned';
        END IF;
      ELSE
        v_action := 'conversation_only';
      END IF;

      INSERT INTO public.zapp_routing_audit_log (
        account_id, conversation_id, contact_name, phone_e164, detected_prefix,
        expected_integration_id, previous_integration_id,
        expected_sector_id, previous_sector_id,
        prefix_message_count, total_message_count, action, details
      ) VALUES (
        v_rec.account_id, v_rec.conversation_id, v_rec.contact_name, v_rec.phone_e164, v_rec.top_prefix,
        v_rec.expected_integration_id, v_rec.current_integration_id,
        v_rec.expected_sector_id, v_rec.current_sector_id,
        v_rec.top_cnt, v_rec.total_cnt, v_action,
        jsonb_build_object(
          'expected_integration_name', v_rec.expected_integration_name,
          'target_department_id', v_target_dept,
          'ratio', round(v_rec.top_cnt::numeric / v_rec.total_cnt::numeric, 4)
        )
      );

      v_fixed := v_fixed + 1;
    END IF;

    IF jsonb_array_length(v_items) < 50 THEN
      v_items := v_items || jsonb_build_object(
        'conversation_id', v_rec.conversation_id,
        'contact_name', v_rec.contact_name,
        'detected_prefix', v_rec.top_prefix,
        'previous_sector_id', v_rec.current_sector_id,
        'expected_sector_id', v_rec.expected_sector_id,
        'previous_integration_id', v_rec.current_integration_id,
        'expected_integration_id', v_rec.expected_integration_id,
        'prefix_message_count', v_rec.top_cnt,
        'total_message_count', v_rec.total_cnt,
        'action', v_action
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'dry_run', p_dry_run,
    'detected', v_detected,
    'fixed', v_fixed,
    'ran_at', now(),
    'sample', v_items
  );
END;
$$;

REVOKE ALL ON FUNCTION public.audit_zapp_conversation_routing(boolean, integer, numeric, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.audit_zapp_conversation_routing(boolean, integer, numeric, integer) TO service_role;