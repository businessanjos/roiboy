ALTER TABLE public.sales_call_analyses
ADD COLUMN seller_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;