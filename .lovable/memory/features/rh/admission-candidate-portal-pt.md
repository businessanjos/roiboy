---
name: Admission Candidate Portal
description: Portal público iamroy.app/admissao/:token para candidato enviar documentos da admissão
type: feature
---
- `hr_admissions.public_token` + `token_expires_at` geram link público compartilhável.
- Página `/admissao/:token` (`PublicAdmissionPortal.tsx`) — dark, mobile-first, sem login.
- Edge function `admission-portal` (verify_jwt=false) com `?action=get` e `?action=upload` (multipart, 15MB max). Usa SECURITY DEFINER rpcs `get_admission_portal` e `submit_admission_doc`.
- Upload vai pro bucket `admission-docs` em `portal/{admissionId}/{docId}.{ext}`, gera signed URL 1 ano, marca doc como `received`.
- RH revisa/aprova no `AdmissionDrawer`. Botão "Copiar link" no drawer usa `getPublicOrigin()`.
- Domínio oficial sempre `iamroy.app` (nunca preview).
