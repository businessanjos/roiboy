
CREATE OR REPLACE FUNCTION public.reconcile_installments_and_entries(p_dry_run boolean DEFAULT false, p_triggered_by text DEFAULT 'cron'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_run_id UUID;
  v_issue RECORD;
  v_new_entry_id UUID;
  v_action TEXT;
  v_before JSONB;
  v_after JSONB;
  v_fixed INT := 0;
  v_skipped INT := 0;
  v_errors INT := 0;
  v_total INT := 0;
  v_category_id UUID;
  v_product_name TEXT;
BEGIN
  INSERT INTO public.financial_reconciliation_runs (triggered_by, dry_run)
  VALUES (p_triggered_by, p_dry_run)
  RETURNING id INTO v_run_id;

  FOR v_issue IN
    SELECT sync.*,
           i.paid_at AS inst_paid_at,
           i.paid_amount AS inst_paid_amount,
           fe.payment_date AS entry_payment_date,
           fe.amount AS entry_amount_full,
           inv.client_id AS inv_client_id
    FROM public.financial_sync_issues_active sync
    JOIN public.installments i ON i.id = sync.installment_id
    LEFT JOIN public.financial_entries fe ON fe.id = sync.entry_id
    LEFT JOIN public.invoices inv ON inv.id = sync.invoice_id
  LOOP
    v_total := v_total + 1;
    v_action := NULL; v_before := NULL; v_after := NULL; v_new_entry_id := NULL;

    BEGIN
      IF v_issue.issue_type = 'missing_entry' THEN
        -- Resolve category:
        -- 1) reuse from another entry of the same contract
        SELECT category_id INTO v_category_id
        FROM public.financial_entries
        WHERE contract_id = v_issue.contract_id
          AND category_id IS NOT NULL
        LIMIT 1;

        -- 2) heuristic by product name → matching "Vendas à Prazo - <X>" category
        IF v_category_id IS NULL THEN
          SELECT p.name INTO v_product_name
          FROM public.client_contracts cc
          LEFT JOIN public.products p ON p.id = cc.product_id
          WHERE cc.id = v_issue.contract_id;

          IF v_product_name IS NOT NULL THEN
            SELECT fc.id INTO v_category_id
            FROM public.financial_categories fc
            WHERE fc.type = 'income'
              AND fc.is_active
              AND (
                (v_product_name ILIKE '%rykas%'      AND fc.name ILIKE '%Rykas%')
                OR (v_product_name ILIKE '%conselho%'  AND fc.name ILIKE '%Conselho%')
                OR (v_product_name ILIKE '%private%'   AND fc.name ILIKE '%Private%')
                OR ((v_product_name ILIKE '%eternum%' OR v_product_name ILIKE '%mvp%' OR v_product_name ILIKE '%eternum club%')
                     AND fc.name ILIKE '%Eternum%')
              )
            ORDER BY fc.display_order NULLS LAST
            LIMIT 1;
          END IF;
        END IF;

        IF v_category_id IS NULL THEN
          v_action := 'skipped_no_category';
          v_skipped := v_skipped + 1;
        ELSE
          v_action := 'create_entry';
          v_before := jsonb_build_object('entry', null);
          IF NOT p_dry_run THEN
            INSERT INTO public.financial_entries (
              account_id, entry_type, description, amount, due_date, status,
              source, source_id, installment_number, contract_id, client_id,
              currency, is_recurring, category_id
            ) VALUES (
              v_issue.account_id, 'receivable',
              'Parcela ' || v_issue.installment_number || ' (reconciliação)',
              v_issue.installment_amount, v_issue.due_date, v_issue.installment_status,
              'contract', v_issue.contract_id, v_issue.installment_number,
              v_issue.contract_id, v_issue.inv_client_id, 'BRL', false, v_category_id
            )
            RETURNING id INTO v_new_entry_id;
          END IF;
          v_after := jsonb_build_object('entry_id', v_new_entry_id, 'status', v_issue.installment_status, 'category_id', v_category_id);
        END IF;

      ELSIF v_issue.issue_type = 'installment_paid_entry_open' THEN
        v_action := 'set_entry_paid';
        v_before := jsonb_build_object('entry_status', v_issue.entry_status);
        IF NOT p_dry_run THEN
          UPDATE public.financial_entries
             SET status = 'paid',
                 payment_date = COALESCE(payment_date, v_issue.inst_paid_at::date, CURRENT_DATE),
                 updated_at = now()
           WHERE id = v_issue.entry_id;
        END IF;
        v_after := jsonb_build_object('entry_status', 'paid');

      ELSIF v_issue.issue_type = 'entry_paid_installment_open' THEN
        v_action := 'set_installment_paid';
        v_before := jsonb_build_object('installment_status', v_issue.installment_status);
        IF NOT p_dry_run THEN
          UPDATE public.installments
             SET status = 'paid',
                 paid_at = COALESCE(paid_at, v_issue.entry_payment_date::timestamptz, now()),
                 paid_amount = COALESCE(paid_amount, v_issue.entry_amount_full),
                 updated_at = now()
           WHERE id = v_issue.installment_id;
        END IF;
        v_after := jsonb_build_object('installment_status', 'paid');

      ELSIF v_issue.issue_type = 'installment_cancelled_entry_active' THEN
        v_action := 'set_entry_cancelled';
        v_before := jsonb_build_object('entry_status', v_issue.entry_status);
        IF NOT p_dry_run THEN
          UPDATE public.financial_entries
             SET status = 'cancelled', updated_at = now()
           WHERE id = v_issue.entry_id;
        END IF;
        v_after := jsonb_build_object('entry_status', 'cancelled');

      ELSIF v_issue.issue_type = 'installment_renegotiated_entry_active' THEN
        v_action := 'set_entry_renegotiated';
        v_before := jsonb_build_object('entry_status', v_issue.entry_status);
        IF NOT p_dry_run THEN
          UPDATE public.financial_entries
             SET status = 'renegotiated', updated_at = now()
           WHERE id = v_issue.entry_id;
        END IF;
        v_after := jsonb_build_object('entry_status', 'renegotiated');

      ELSIF v_issue.issue_type = 'entry_renegotiated_installment_active' THEN
        v_action := 'set_installment_renegotiated';
        v_before := jsonb_build_object('installment_status', v_issue.installment_status);
        IF NOT p_dry_run THEN
          UPDATE public.installments
             SET status = 'renegotiated',
                 renegotiated_at = COALESCE(renegotiated_at, now()),
                 updated_at = now()
           WHERE id = v_issue.installment_id;
        END IF;
        v_after := jsonb_build_object('installment_status', 'renegotiated');

      ELSIF v_issue.issue_type = 'amount_mismatch' THEN
        v_action := 'fix_entry_amount';
        v_before := jsonb_build_object('entry_amount', v_issue.entry_amount);
        IF NOT p_dry_run THEN
          UPDATE public.financial_entries
             SET amount = v_issue.installment_amount, updated_at = now()
           WHERE id = v_issue.entry_id;
        END IF;
        v_after := jsonb_build_object('entry_amount', v_issue.installment_amount);

      ELSIF v_issue.issue_type = 'entry_cancelled_installment_active' THEN
        v_action := 'skipped_needs_review';
        v_skipped := v_skipped + 1;
      ELSE
        v_action := 'skipped_unknown_issue';
        v_skipped := v_skipped + 1;
      END IF;

      IF v_action NOT LIKE 'skipped_%' THEN
        v_fixed := v_fixed + 1;
      END IF;

      INSERT INTO public.financial_reconciliation_log (
        run_id, account_id, installment_id, entry_id, contract_id,
        issue_type, action, before, after
      ) VALUES (
        v_run_id, v_issue.account_id, v_issue.installment_id, v_issue.entry_id,
        v_issue.contract_id, v_issue.issue_type, v_action, v_before, v_after
      );

    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      INSERT INTO public.financial_reconciliation_log (
        run_id, account_id, installment_id, entry_id, contract_id,
        issue_type, action, error
      ) VALUES (
        v_run_id, v_issue.account_id, v_issue.installment_id, v_issue.entry_id,
        v_issue.contract_id, v_issue.issue_type, 'error', SQLERRM
      );
    END;
  END LOOP;

  UPDATE public.financial_reconciliation_runs
     SET finished_at = now(),
         issues_found = v_total,
         fixed = v_fixed,
         skipped = v_skipped,
         errors = v_errors
   WHERE id = v_run_id;

  RETURN v_run_id;
END;
$function$;
