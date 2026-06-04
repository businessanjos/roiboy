-- Duplicate the existing template back into a real offer so Bruna's generated offer shows up in the list
INSERT INTO public.hr_job_offers (
  account_id, created_by, public_token,
  candidate_name, candidate_email, candidate_phone,
  position_title, department, seniority, work_model, contract_type, unit, reports_to,
  salary_amount, salary_currency, salary_note, variable_compensation,
  benefits, perks, success_metrics,
  start_date, offer_expires_at,
  hero_headline, company_intro, role_pitch, next_steps,
  signer_name, signer_role,
  accent_color, cover_image_url, candidate_photo_url,
  is_template, template_name, status, sent_at
)
SELECT
  account_id, created_by, gen_random_uuid()::text,
  candidate_name, candidate_email, candidate_phone,
  position_title, department, seniority, work_model, contract_type, unit, reports_to,
  salary_amount, salary_currency, salary_note, variable_compensation,
  benefits, perks, success_metrics,
  start_date, offer_expires_at,
  hero_headline, company_intro, role_pitch, next_steps,
  signer_name, signer_role,
  accent_color, cover_image_url, candidate_photo_url,
  false, NULL, COALESCE(status,'draft'), sent_at
FROM public.hr_job_offers
WHERE id = 'a2582301-8d76-4b90-817a-3bda8241aae6';