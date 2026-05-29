
-- Fix Rykas v2 template defects:
-- 1) Missing </div> for rk-parties when DOC_TYPE != PJ (closing tag was trapped inside the PJ conditional)
-- 2) Duplicated "os demais os demais" in the cheque clause
-- 3) Wrong company name "Eternum Club Mentoring Ltda" -> "Eternum Mentoring Club Ltda"

DO $$
DECLARE
  v_old1 text := '</dd><dt>Telefone</dt><dd>{{CELULAR}}</dd></dl></div></div>{{/if}}<div class="rk-pullquote">';
  v_new1 text := '</dd><dt>Telefone</dt><dd>{{CELULAR}}</dd></dl></div>{{/if}}</div><div class="rk-pullquote">';
  v_old2 text := 'e os demais os demais pagamentos mediante CHEQUES';
  v_new2 text := 'e os demais pagamentos mediante CHEQUES';
  v_old3 text := '<dt>Razão Social</dt><dd>Eternum Club Mentoring Ltda</dd>';
  v_new3 text := '<dt>Razão Social</dt><dd>Eternum Mentoring Club Ltda</dd>';
BEGIN
  UPDATE contract_templates
     SET content_html = replace(replace(replace(content_html, v_old1, v_new1), v_old2, v_new2), v_old3, v_new3),
         updated_at = now()
   WHERE content_html LIKE '%' || v_old1 || '%'
      OR content_html LIKE '%' || v_old2 || '%'
      OR content_html LIKE '%' || v_old3 || '%';

  UPDATE digital_contracts
     SET template_html = replace(replace(replace(template_html, v_old1, v_new1), v_old2, v_new2), v_old3, v_new3),
         updated_at = now()
   WHERE template_html IS NOT NULL
     AND (template_html LIKE '%' || v_old1 || '%'
       OR template_html LIKE '%' || v_old2 || '%'
       OR template_html LIKE '%' || v_old3 || '%');
END $$;
