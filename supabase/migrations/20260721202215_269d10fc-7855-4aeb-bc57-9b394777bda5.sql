
-- Runs summary
CREATE TABLE IF NOT EXISTS public.financial_reconciliation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  triggered_by TEXT NOT NULL DEFAULT 'cron',
  dry_run BOOLEAN NOT NULL DEFAULT false,
  issues_found INTEGER NOT NULL DEFAULT 0,
  fixed INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  errors INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.financial_reconciliation_runs TO authenticated;
GRANT ALL ON public.financial_reconciliation_runs TO service_role;
ALTER TABLE public.financial_reconciliation_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth read reconciliation runs" ON public.financial_reconciliation_runs;
CREATE POLICY "auth read reconciliation runs" ON public.financial_reconciliation_runs
  FOR SELECT TO authenticated USING (true);

-- Per-row log
CREATE TABLE IF NOT EXISTS public.financial_reconciliation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES public.financial_reconciliation_runs(id) ON DELETE CASCADE,
  account_id UUID,
  installment_id UUID,
  entry_id UUID,
  contract_id UUID,
  issue_type TEXT NOT NULL,
  action TEXT NOT NULL,
  before JSONB,
  after JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recon_log_run ON public.financial_reconciliation_log(run_id);
CREATE INDEX IF NOT EXISTS idx_recon_log_account ON public.financial_reconciliation_log(account_id);
CREATE INDEX IF NOT EXISTS idx_recon_log_installment ON public.financial_reconciliation_log(installment_id);
GRANT SELECT ON public.financial_reconciliation_log TO authenticated;
GRANT ALL ON public.financial_reconciliation_log TO service_role;
ALTER TABLE public.financial_reconciliation_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth read reconciliation log" ON public.financial_reconciliation_log;
CREATE POLICY "auth read reconciliation log" ON public.financial_reconciliation_log
  FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.reconcile_installments_and_entries(
  p_dry_run BOOLEAN DEFAULT false,
  p_triggered_by TEXT DEFAULT 'cron'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
        v_action := 'create_entry';
        v_before := jsonb_build_object('entry', null);
        IF NOT p_dry_run THEN
          INSERT INTO public.financial_entries (
            account_id, entry_type, description, amount, due_date, status,
            source, source_id, installment_number, contract_id, client_id,
            currency, is_recurring
          ) VALUES (
            v_issue.account_id, 'receivable',
            'Parcela ' || v_issue.installment_number || ' (reconciliação)',
            v_issue.installment_amount, v_issue.due_date, v_issue.installment_status,
            'contract', v_issue.contract_id, v_issue.installment_number,
            v_issue.contract_id, v_issue.inv_client_id, 'BRL', false
          )
          RETURNING id INTO v_new_entry_id;
        END IF;
        v_after := jsonb_build_object('entry_id', v_new_entry_id, 'status', v_issue.installment_status);

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
$$;

REVOKE ALL ON FUNCTION public.reconcile_installments_and_entries(BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reconcile_installments_and_entries(BOOLEAN, TEXT) TO authenticated, service_role;

-- Schedule daily at 06:00 UTC (~03:00 BRT). Unschedule prior if present.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reconcile-installments-entries-daily') THEN
    PERFORM cron.unschedule('reconcile-installments-entries-daily');
  END IF;
  PERFORM cron.schedule(
    'reconcile-installments-entries-daily',
    '0 6 * * *',
    $cron$SELECT public.reconcile_installments_and_entries(false, 'cron');$cron$
  );
END $$;
