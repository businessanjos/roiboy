ALTER TABLE public.deals REPLICA IDENTITY FULL;
ALTER TABLE public.deal_field_values REPLICA IDENTITY FULL;
ALTER TABLE public.sales_quotas REPLICA IDENTITY FULL;
ALTER TABLE public.sales_product_goals REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.deals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.deal_field_values;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales_quotas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales_product_goals;