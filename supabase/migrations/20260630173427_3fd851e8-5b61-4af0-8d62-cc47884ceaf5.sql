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
    ARRAY['certidao_filhos', 'Certidão de Nascimento dos Filhos (até 14 anos, se houver)'],
    ARRAY['cpf_filhos', 'CPF dos Filhos (se houver)'],
    ARRAY['foto_3x4', 'Foto 3x4 recente'],
    ARRAY['comprovante_escolaridade', 'Comprovante de Escolaridade'],
    ARRAY['conta_bancaria', 'Dados Bancários (conta salário)'],
    ARRAY['exame_admissional', 'ASO – Exame Admissional'],
    ARRAY['contrato_assinado', 'Contrato de Trabalho Assinado']
  ];
  i int;
BEGIN
  FOR i IN 1..array_length(docs, 1) LOOP
    INSERT INTO public.hr_admission_documents (admission_id, doc_key, label, sort_order, required)
    VALUES (_admission_id, docs[i][1], docs[i][2], i, docs[i][1] NOT IN ('certidao_filhos', 'cpf_filhos', 'reservista'));
  END LOOP;
END;
$$;

-- Suaviza label do certidao_filhos existente (deixa claro "se houver")
UPDATE public.hr_admission_documents
SET label = 'Certidão de Nascimento dos Filhos (até 14 anos, se houver)',
    required = false
WHERE doc_key = 'certidao_filhos';

-- Backfill: adiciona cpf_filhos em admissões já existentes que ainda não têm
INSERT INTO public.hr_admission_documents (admission_id, doc_key, label, sort_order, required)
SELECT a.id,
       'cpf_filhos',
       'CPF dos Filhos (se houver)',
       COALESCE((SELECT sort_order FROM public.hr_admission_documents d2
                 WHERE d2.admission_id = a.id AND d2.doc_key = 'certidao_filhos'), 9) + 1,
       false
FROM public.hr_admissions a
WHERE NOT EXISTS (
  SELECT 1 FROM public.hr_admission_documents d
  WHERE d.admission_id = a.id AND d.doc_key = 'cpf_filhos'
);