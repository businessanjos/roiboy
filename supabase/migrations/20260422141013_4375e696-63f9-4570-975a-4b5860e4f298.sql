create type public.marketing_ai_decision as enum ('accepted', 'edited', 'rejected');

create table public.marketing_ai_suggestion_reviews (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  suggestion_type text not null,
  source_function text not null,
  source_item_key text null,
  decision public.marketing_ai_decision not null,
  objective text null,
  profile_platform text null,
  profile_id uuid null,
  profile_username text null,
  suggestion_payload jsonb not null default '{}'::jsonb,
  edited_payload jsonb null,
  input_context jsonb not null default '{}'::jsonb,
  decision_notes text null,
  created_by uuid null,
  reviewed_by uuid null,
  reviewed_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.marketing_ai_suggestion_reviews enable row level security;

create index idx_marketing_ai_reviews_account_reviewed_at
  on public.marketing_ai_suggestion_reviews (account_id, reviewed_at desc);

create index idx_marketing_ai_reviews_source
  on public.marketing_ai_suggestion_reviews (account_id, suggestion_type, source_function);

create index idx_marketing_ai_reviews_decision
  on public.marketing_ai_suggestion_reviews (account_id, decision);

create policy "Users view AI reviews in their account"
on public.marketing_ai_suggestion_reviews
for select
using (account_id = get_current_user_account_id());

create policy "Users insert AI reviews in their account"
on public.marketing_ai_suggestion_reviews
for insert
with check (account_id = get_current_user_account_id());

create policy "Users update AI reviews in their account"
on public.marketing_ai_suggestion_reviews
for update
using (account_id = get_current_user_account_id());

create policy "Users delete AI reviews in their account"
on public.marketing_ai_suggestion_reviews
for delete
using (account_id = get_current_user_account_id());

drop trigger if exists update_marketing_ai_suggestion_reviews_updated_at on public.marketing_ai_suggestion_reviews;

create trigger update_marketing_ai_suggestion_reviews_updated_at
before update on public.marketing_ai_suggestion_reviews
for each row
execute function public.update_updated_at_column();