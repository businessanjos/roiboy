
-- Insert PJ collaborators into hr_service_providers
INSERT INTO public.hr_service_providers (
  account_id, full_name, email, phone, cpf, department, hr_department_id,
  position, hire_date, status, avatar_url, emergency_contact_name,
  emergency_contact_phone, notes, fee_amount, service_type
)
SELECT
  account_id, full_name, email, phone, cpf, department, hr_department_id,
  position, hire_date, status, avatar_url, emergency_contact_name,
  emergency_contact_phone, notes, salary, 'PJ'
FROM public.hr_collaborators
WHERE employment_type = 'pj';

-- Remove PJ collaborators from hr_collaborators
DELETE FROM public.hr_collaborators WHERE employment_type = 'pj';
