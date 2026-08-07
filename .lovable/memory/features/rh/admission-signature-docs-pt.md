---
name: Admission signature documents
description: Documentos internos (regulamento, sigilo, LGPD etc.) assinados digitalmente pelo novo colaborador no portal de admissão
type: feature
---
- Biblioteca editável em `hr_document_templates` (HTML + variáveis + `default_selected`), gerida na aba "Modelos de documentos" em RH > Admissões (`DocumentTemplatesTab.tsx`). Seeds em `src/lib/hr/admissionDocTemplates.ts` (6 docs convertidos dos DOCX: Regulamento Interno, Sigilo, Monitoramento, LGPD, Uso de Imagem, Banco de Horas).
- Trigger `create_admission_on_offer_accept` já cria os documentos marcados como padrão; o RH pode adicionar/remover pelo bloco "Documentos para assinar" no `AdmissionDrawer` (`AdmissionSignatureDocs.tsx`). Documento assinado não pode ser removido.
- `hr_admission_documents.doc_type='signature'` com `body_html`, `signed_html`, `signature_image_url`, `signer_name/cpf/ip/user_agent`, `signature_hash`, `signed_at`.
- Candidato assina no portal `/admissao/:token`: preenche `signer_data` (nome, CPF, RG, endereço) uma vez, lê o documento renderizado e desenha a assinatura (`SignaturePad.tsx` + `SignatureDocCard.tsx`). Edge function `admission-portal` ações `save_signer` e `sign`; RPCs `save_admission_signer_data` e `sign_admission_document`.
- Variáveis `{{NOME COMPLETO}}`, `{{CPF}}`, `{{RG}}`, `{{RUA}}`, `{{Nº}}`, `{{BAIRRO}}`, `{{CIDADE}}`, `{{ESTADO}}`, `{{DATA DE HOJE}}` — render/sanitize em `src/lib/hr/admissionDocVars.ts` (DOMPurify). Estilo do documento na classe global `.admission-doc` (index.css), com `.tpl-filled` e `.tpl-missing`.
- Logo da Eternum (`letreiro.png`) no portal; nunca usar a logo dos DOCX originais.
