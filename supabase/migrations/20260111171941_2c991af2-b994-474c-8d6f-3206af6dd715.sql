-- Adicionar Everton Pieri como super_admin usando auth_user_id
INSERT INTO super_admins (user_id) 
VALUES ('1958678f-69c7-4f95-b43a-01f4139421f2')
ON CONFLICT DO NOTHING;