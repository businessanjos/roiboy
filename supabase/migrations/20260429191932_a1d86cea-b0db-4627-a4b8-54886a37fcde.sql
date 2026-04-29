-- Append Part 3 (Multas continuação, Vigência, Rescisão, Disposições Gerais, Assinaturas) to Rykas Mentoring contract template
DO $$
DECLARE
  v_b64 TEXT;
BEGIN
  v_b64 := pg_read_file('/tmp/part3.b64');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;