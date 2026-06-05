
CREATE OR REPLACE FUNCTION public.seed_clt_admission_docs(_admission_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  docs text[][] := ARRAY[
    ARRAY['rg', 'RG ou CNH (frente e verso)'],
    ARRAY['cpf', 'CPF'],
    ARRAY['ctps', 'CTPS Digital (PDF)'],
    ARRAY['titulo_eleitor', 'Título de Eleitor'],
    ARRAY['reservista', 'Certificado de Reservista (homens)'],
    ARRAY['comprovante_residencia', 'Comprovante de Residência (até 90 dias)'],
    ARRAY['pis_pasep', 'PIS / PASEP / NIT'],
    ARRAY['certidao_civil', 'Certidão de Nascimento ou Casamento'],
    ARRAY['certidao_filhos', 'Certidão de Nascimento dos Filhos (até 14 anos)'],
    ARRAY['foto_3x4', 'Foto 3x4 recente'],
    ARRAY['comprovante_escolaridade', 'Comprovante de Escolaridade'],
    ARRAY['conta_bancaria', 'Dados Bancários (conta salário)'],
    ARRAY['exame_admissional', 'ASO – Exame Admissional'],
    ARRAY['contrato_assinado', 'Contrato de Trabalho Assinado']
  ];
  i int;
BEGIN
  FOR i IN 1..array_length(docs, 1) LOOP
    INSERT INTO public.hr_admission_documents (admission_id, doc_key, label, sort_order)
    VALUES (_admission_id, docs[i][1], docs[i][2], i);
  END LOOP;
END;
$$;

UPDATE public.hr_admission_documents
SET label = 'RG ou CNH (frente e verso)'
WHERE doc_key = 'rg' AND label = 'RG (frente e verso)';
