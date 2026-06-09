UPDATE public.hr_service_providers
SET provider_kind = 'director'
WHERE lower(full_name) IN (
  'arthur mudri',
  'jonathan marcato',
  'jessica marcato',
  'jéssica marcato',
  'maikol quintana parnow',
  'maikol parnow'
);