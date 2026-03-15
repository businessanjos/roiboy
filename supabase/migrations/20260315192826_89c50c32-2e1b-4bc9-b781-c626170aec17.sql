
-- Add goal_type to differentiate between different kinds of goals
ALTER TABLE public.sales_monthly_goals 
  ADD COLUMN goal_type text NOT NULL DEFAULT 'revenue',
  ADD COLUMN cargo text NOT NULL DEFAULT 'Vendedor';

-- Drop old unique constraint and create new one including goal_type
ALTER TABLE public.sales_monthly_goals 
  DROP CONSTRAINT sales_monthly_goals_account_id_user_id_year_month_key;

ALTER TABLE public.sales_monthly_goals 
  ADD CONSTRAINT sales_monthly_goals_account_user_month_type_key 
  UNIQUE (account_id, user_id, year_month, goal_type);
