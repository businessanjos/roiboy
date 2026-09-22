UPDATE public.hr_collaborators c SET user_id = u.id, email = COALESCE(c.email, u.email)
FROM public.users u
WHERE c.user_id IS NULL AND (
  (c.full_name = 'Everton Pieri' AND u.id = 'de43a643-0109-4afb-ac35-be768dbf4090') OR
  (c.full_name = 'Jéssica Marcato' AND u.id = 'c064c5d5-cdb5-47cc-99ce-ad416b6407b1') OR
  (c.full_name = 'Arthur Mudri' AND u.id = '95d0c883-0ab8-48e3-9130-4d3bbeeb59dd') OR
  (c.full_name = 'Jonathan Marcato' AND u.id = '1232ec15-5f66-4b5f-9e74-f40d436f9d0f')
);