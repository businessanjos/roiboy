-- ===== Helper: can the caller manage a stored object (owner or account admin / super admin)
CREATE OR REPLACE FUNCTION public.storage_can_manage_object(_owner_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    _owner_id = auth.uid()::text
    OR public.is_super_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = auth.uid()
               AND (u.role::text IN ('admin','super_admin') OR u.is_also_admin = true))
  )
$$;
REVOKE EXECUTE ON FUNCTION public.storage_can_manage_object(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.storage_can_manage_object(text) TO authenticated;

-- ===== Financial reconciliation: super admins only
DROP POLICY IF EXISTS "auth read reconciliation runs" ON public.financial_reconciliation_runs;
CREATE POLICY "Super admins read reconciliation runs" ON public.financial_reconciliation_runs
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "auth read reconciliation log" ON public.financial_reconciliation_log;
CREATE POLICY "Super admins read reconciliation log" ON public.financial_reconciliation_log
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));

-- ===== Leader meetings: account scoped
DROP POLICY IF EXISTS "Authenticated can delete leader meetings" ON public.leader_meetings;
CREATE POLICY "Account members delete leader meetings" ON public.leader_meetings
  FOR DELETE TO authenticated USING (public.user_belongs_to_account(account_id));
DROP POLICY IF EXISTS "Authenticated full access sections" ON public.leader_meeting_sections;
CREATE POLICY "Account members access sections" ON public.leader_meeting_sections
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.leader_meetings m WHERE m.id = meeting_id AND public.user_belongs_to_account(m.account_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.leader_meetings m WHERE m.id = meeting_id AND public.user_belongs_to_account(m.account_id)));
DROP POLICY IF EXISTS "Authenticated full access actions" ON public.leader_meeting_actions;
CREATE POLICY "Account members access actions" ON public.leader_meeting_actions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.leader_meetings m WHERE m.id = meeting_id AND public.user_belongs_to_account(m.account_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.leader_meetings m WHERE m.id = meeting_id AND public.user_belongs_to_account(m.account_id)));

-- ===== Job offers: public access only through token RPCs
DROP POLICY IF EXISTS "Public can read offers by token" ON public.hr_job_offers;

CREATE OR REPLACE FUNCTION public.get_job_offer_by_token(_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.hr_job_offers;
BEGIN
  IF _token IS NULL OR length(_token) < 8 THEN RETURN NULL; END IF;
  SELECT * INTO r FROM public.hr_job_offers WHERE public_token = _token;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF r.first_viewed_at IS NULL OR r.status = 'sent' THEN
    UPDATE public.hr_job_offers
      SET first_viewed_at = COALESCE(first_viewed_at, now()),
          view_count = COALESCE(view_count, 0) + 1,
          status = CASE WHEN status = 'sent' THEN 'viewed' ELSE status END
      WHERE id = r.id
      RETURNING * INTO r;
  END IF;
  RETURN to_jsonb(r) - 'account_id';
END $$;

CREATE OR REPLACE FUNCTION public.respond_job_offer(_token text, _status text, _message text, _email text, _phone text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.hr_job_offers;
BEGIN
  IF _status NOT IN ('accepted','declined') THEN RAISE EXCEPTION 'Resposta inválida'; END IF;
  IF _message IS NOT NULL AND length(_message) > 5000 THEN RAISE EXCEPTION 'Mensagem muito longa'; END IF;
  IF _status = 'accepted' AND (_email IS NULL OR _email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' OR length(regexp_replace(COALESCE(_phone,''), '\D', '', 'g')) < 10) THEN
    RAISE EXCEPTION 'Dados de contato inválidos';
  END IF;
  UPDATE public.hr_job_offers
    SET status = _status, responded_at = now(), response_message = NULLIF(_message, ''),
        candidate_email = CASE WHEN _status = 'accepted' THEN left(_email, 255) ELSE candidate_email END,
        candidate_phone = CASE WHEN _status = 'accepted' THEN left(_phone, 40) ELSE candidate_phone END
    WHERE public_token = _token
    RETURNING * INTO r;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;
  RETURN to_jsonb(r) - 'account_id';
END $$;
GRANT EXECUTE ON FUNCTION public.get_job_offer_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.respond_job_offer(text, text, text, text, text) TO anon, authenticated;

-- ===== Storage: uploads bound to the uploader
DROP POLICY IF EXISTS "Authenticated users can upload marketing media" ON storage.objects;
CREATE POLICY "Authenticated users can upload marketing media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'marketing-task-media' AND owner_id = (select auth.uid()::text));
DROP POLICY IF EXISTS "Authenticated users can upload playbook media" ON storage.objects;
CREATE POLICY "Authenticated users can upload playbook media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'playbook-media' AND owner_id = (select auth.uid()::text));
DROP POLICY IF EXISTS "Authenticated users can upload event media" ON storage.objects;
CREATE POLICY "Authenticated users can upload event media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'event-media' AND owner_id = (select auth.uid()::text));
DROP POLICY IF EXISTS "Authenticated users can upload to zapp-media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload zapp media" ON storage.objects;
CREATE POLICY "Authenticated users can upload zapp media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'zapp-media' AND owner_id = (select auth.uid()::text));
DROP POLICY IF EXISTS "Authenticated users can upload recordings" ON storage.objects;
CREATE POLICY "Authenticated users can upload recordings" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'call-recordings' AND owner_id = (select auth.uid()::text));
DROP POLICY IF EXISTS "Users can upload deal activity files" ON storage.objects;
CREATE POLICY "Users can upload deal activity files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'deal-activities' AND owner_id = (select auth.uid()::text));
DROP POLICY IF EXISTS "Users can upload avatars" ON storage.objects;
CREATE POLICY "Users can upload avatars" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND owner_id = (select auth.uid()::text));
DROP POLICY IF EXISTS "Users can upload bank logos" ON storage.objects;
CREATE POLICY "Users can upload bank logos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bank-logos' AND owner_id = (select auth.uid()::text));
DROP POLICY IF EXISTS "Users can upload ROI screenshots" ON storage.objects;
CREATE POLICY "Users can upload ROI screenshots" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'roi-screenshots' AND owner_id = (select auth.uid()::text));
DROP POLICY IF EXISTS "ai_knowledge_docs_insert" ON storage.objects;
CREATE POLICY "ai_knowledge_docs_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ai-knowledge-docs' AND owner_id = (select auth.uid()::text)
    AND (storage.foldername(name))[1] = public.get_current_user_account_id()::text);
DROP POLICY IF EXISTS "Account isolated: upload followup files" ON storage.objects;
CREATE POLICY "Account isolated: upload followup files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'client-followups' AND owner_id = (select auth.uid()::text)
    AND (storage.foldername(name))[1] = public.get_current_user_account_id()::text);

-- ===== Storage: update/delete only by owner or admins
DROP POLICY IF EXISTS "Account isolated: update followup files" ON storage.objects;
CREATE POLICY "Account isolated: update followup files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'client-followups' AND (storage.foldername(name))[1] = public.get_current_user_account_id()::text AND public.storage_can_manage_object(owner_id));
DROP POLICY IF EXISTS "Account isolated: delete followup files" ON storage.objects;
CREATE POLICY "Account isolated: delete followup files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'client-followups' AND (storage.foldername(name))[1] = public.get_current_user_account_id()::text AND public.storage_can_manage_object(owner_id));
DROP POLICY IF EXISTS "Users can update their avatars" ON storage.objects;
CREATE POLICY "Users can update their avatars" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND public.storage_can_manage_object(owner_id));
DROP POLICY IF EXISTS "Users can delete their avatars" ON storage.objects;
CREATE POLICY "Users can delete their avatars" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND public.storage_can_manage_object(owner_id));
DROP POLICY IF EXISTS "Authenticated users can update their playbook media" ON storage.objects;
CREATE POLICY "Authenticated users can update their playbook media" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'playbook-media' AND public.storage_can_manage_object(owner_id));
DROP POLICY IF EXISTS "Authenticated users can delete playbook media" ON storage.objects;
CREATE POLICY "Authenticated users can delete playbook media" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'playbook-media' AND public.storage_can_manage_object(owner_id));
DROP POLICY IF EXISTS "Users can update their deal activity files" ON storage.objects;
CREATE POLICY "Users can update their deal activity files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'deal-activities' AND public.storage_can_manage_object(owner_id));
DROP POLICY IF EXISTS "Users can delete their deal activity files" ON storage.objects;
CREATE POLICY "Users can delete their deal activity files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'deal-activities' AND public.storage_can_manage_object(owner_id));
DROP POLICY IF EXISTS "Users can update their event media" ON storage.objects;
CREATE POLICY "Users can update their event media" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'event-media' AND public.storage_can_manage_object(owner_id));
DROP POLICY IF EXISTS "Users can delete their event media" ON storage.objects;
CREATE POLICY "Users can delete their event media" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'event-media' AND public.storage_can_manage_object(owner_id));
DROP POLICY IF EXISTS "Users can update their bank logos" ON storage.objects;
CREATE POLICY "Users can update their bank logos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'bank-logos' AND public.storage_can_manage_object(owner_id));
DROP POLICY IF EXISTS "Users can delete their bank logos" ON storage.objects;
CREATE POLICY "Users can delete their bank logos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'bank-logos' AND public.storage_can_manage_object(owner_id));
DROP POLICY IF EXISTS "Users can delete their marketing media" ON storage.objects;
CREATE POLICY "Users can delete their marketing media" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'marketing-task-media' AND public.storage_can_manage_object(owner_id));
DROP POLICY IF EXISTS "Users can delete ROI screenshots" ON storage.objects;
CREATE POLICY "Users can delete ROI screenshots" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'roi-screenshots' AND public.storage_can_manage_object(owner_id));
DROP POLICY IF EXISTS "Authenticated users can delete zapp media" ON storage.objects;
CREATE POLICY "Authenticated users can delete zapp media" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'zapp-media' AND public.storage_can_manage_object(owner_id));
DROP POLICY IF EXISTS "ai_knowledge_docs_update" ON storage.objects;
CREATE POLICY "ai_knowledge_docs_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'ai-knowledge-docs' AND (storage.foldername(name))[1] = public.get_current_user_account_id()::text AND public.storage_can_manage_object(owner_id))
  WITH CHECK (bucket_id = 'ai-knowledge-docs' AND (storage.foldername(name))[1] = public.get_current_user_account_id()::text);
DROP POLICY IF EXISTS "ai_knowledge_docs_delete" ON storage.objects;
CREATE POLICY "ai_knowledge_docs_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'ai-knowledge-docs' AND (storage.foldername(name))[1] = public.get_current_user_account_id()::text AND public.storage_can_manage_object(owner_id));

-- ===== Storage: private reads scoped to account
DROP POLICY IF EXISTS "ai_knowledge_docs_select" ON storage.objects;
CREATE POLICY "ai_knowledge_docs_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ai-knowledge-docs' AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = public.get_current_user_account_id()::text);
DROP POLICY IF EXISTS "Authenticated can read provider invoices files" ON storage.objects;
CREATE POLICY "Account members can read provider invoices files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'provider-invoices' AND auth.uid() IS NOT NULL
    AND public.user_belongs_to_account(((storage.foldername(name))[1])::uuid));