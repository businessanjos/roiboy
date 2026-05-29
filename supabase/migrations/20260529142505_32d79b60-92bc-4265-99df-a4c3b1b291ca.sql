UPDATE contract_templates SET content_html =
  replace(
    replace(
      replace(
        replace(
          replace(
            replace(
              replace(
                replace(
                  replace(content_html,
                    'R$ 70.000,00 (setenta mil reais)', '{{TOTAL_VALUE}}'),
                  'R$ 80.400,00 (oitenta mil e quatrocentos reais)', '{{TOTAL_VALUE}}'),
                'em até <strong>12 (doze) pagamentos mensais</strong>', 'em <strong>{{INSTALLMENTS}}</strong> parcelas mensais'),
              '<strong>12 (doze) parcelas mensais e iguais</strong>', '<strong>{{INSTALLMENTS}}</strong> parcelas mensais e iguais'),
            '<strong>11 (onze) pagamentos mediante CHEQUES</strong>', 'os demais pagamentos mediante CHEQUES'),
          'Quando o pagamento for parcelado em 12 (doze) vezes', 'Quando o pagamento for parcelado'),
        '{{#if FORMA_PAGAMENTO_RYKAS=A_VISTA}}', '{{#if __MODALIDADE_PAGAMENTO_UI__=a_vista}}'),
      '{{#if FORMA_PAGAMENTO_RYKAS=CARTAO_12X}}', '{{#if __MODALIDADE_PAGAMENTO_UI__=parcelado}}'),
    '{{#if FORMA_PAGAMENTO_RYKAS=CHEQUE_1_11}}', '{{#if __MODALIDADE_PAGAMENTO_UI__=cheque}}'),
  updated_at = now()
WHERE content_html LIKE '%FORMA_PAGAMENTO_RYKAS=A_VISTA%';

UPDATE digital_contracts SET template_html =
  replace(
    replace(
      replace(
        replace(
          replace(
            replace(
              replace(
                replace(
                  replace(template_html,
                    'R$ 70.000,00 (setenta mil reais)', '{{TOTAL_VALUE}}'),
                  'R$ 80.400,00 (oitenta mil e quatrocentos reais)', '{{TOTAL_VALUE}}'),
                'em até <strong>12 (doze) pagamentos mensais</strong>', 'em <strong>{{INSTALLMENTS}}</strong> parcelas mensais'),
              '<strong>12 (doze) parcelas mensais e iguais</strong>', '<strong>{{INSTALLMENTS}}</strong> parcelas mensais e iguais'),
            '<strong>11 (onze) pagamentos mediante CHEQUES</strong>', 'os demais pagamentos mediante CHEQUES'),
          'Quando o pagamento for parcelado em 12 (doze) vezes', 'Quando o pagamento for parcelado'),
        '{{#if FORMA_PAGAMENTO_RYKAS=A_VISTA}}', '{{#if __MODALIDADE_PAGAMENTO_UI__=a_vista}}'),
      '{{#if FORMA_PAGAMENTO_RYKAS=CARTAO_12X}}', '{{#if __MODALIDADE_PAGAMENTO_UI__=parcelado}}'),
    '{{#if FORMA_PAGAMENTO_RYKAS=CHEQUE_1_11}}', '{{#if __MODALIDADE_PAGAMENTO_UI__=cheque}}'),
  updated_at = now()
WHERE template_html LIKE '%FORMA_PAGAMENTO_RYKAS=A_VISTA%';