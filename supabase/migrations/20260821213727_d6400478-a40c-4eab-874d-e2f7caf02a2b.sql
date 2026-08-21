DELETE FROM public.client_revenue_history h
WHERE h.client_id = 'cc8e8c3e-fd18-4731-b378-27b75dd0f792'
  AND h.month = '2026-07'
  AND EXISTS (
    SELECT 1 FROM public.client_revenue_history o
    WHERE o.client_id = h.client_id
      AND o.month = '2025-07'
      AND o.revenue = h.revenue
  );