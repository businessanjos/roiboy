CREATE OR REPLACE FUNCTION public.get_deal_transfer_whatsapp_status(_deal_ids uuid[])
RETURNS TABLE(deal_id uuid, recipient_name text, sent_at timestamptz, result jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT DISTINCT ON (n.source_id) n.source_id, u.name, s.created_at, s.result
  FROM public.notifications n
  JOIN public.transfer_whatsapp_sends s ON s.notification_id = n.id
  LEFT JOIN public.users u ON u.id = n.user_id
  WHERE n.type = 'deal_transferred'
    AND n.source_id = ANY(_deal_ids)
    AND n.account_id = public.get_user_account_id()
    AND (public.can_manage_spiff_payments(auth.uid())
         OR EXISTS (SELECT 1 FROM public.deal_transfer_requests r
                    WHERE r.deal_id = n.source_id AND r.requester_id = public.get_current_user_id()))
  ORDER BY n.source_id, s.created_at DESC
$$;
REVOKE ALL ON FUNCTION public.get_deal_transfer_whatsapp_status(uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_deal_transfer_whatsapp_status(uuid[]) TO authenticated;