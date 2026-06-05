---
name: Admission Candidate Portal
description: Portal público iamroy.app/admissao/:token para candidato enviar documentos da admissão
type: feature
---
- `hr_admissions.public_token` + `token_expires_at` geram link público compartilhável (sem expiração padrão).
- Página `/admissao/:token` (`PublicAdmissionPortal.tsx`) — dark, mobile-first, sem login: tela de sucesso quando 100% enviado, botão **Tirar foto** (`capture=environment`) + **Enviar arquivo**, link pra abrir o que já foi enviado, mostra motivo de rejeição vermelho.
- Edge function `admission-portal` (verify_jwt=false): `?action=get` e `?action=upload` (multipart, 15MB max). Valida MIME/extensão (jpg/png/webp/heic/pdf) e confirma que o doc pertence à admissão. Usa SECURITY DEFINER rpcs `get_admission_portal` e `submit_admission_doc`.
- Upload vai pro bucket `admission-docs` em `portal/{admissionId}/{docId}.{ext}`, gera signed URL 1 ano, marca doc como `received` com `uploaded_via='candidate'` e limpa `notes` (motivo de rejeição anterior). Toca `hr_admissions.updated_at`.
- RH no `AdmissionDrawer`:
  - Badge azul "X novos envios do candidato" no header do checklist; linha do doc fica destacada azul quando recebido do candidato.
  - Botão "Rejeitar com motivo" (ícone amarelo) abre Dialog pra texto — vira motivo visível no portal.
  - `handleRemoveFile` agora limpa `{account_id}/{adm}/` E `portal/{adm}/` (evita arquivo órfão).
  - Upload pelo RH grava `uploaded_via='rh'`.
- Botão "Copiar link" no drawer usa `getPublicOrigin()` → domínio oficial sempre `iamroy.app` (nunca preview).
