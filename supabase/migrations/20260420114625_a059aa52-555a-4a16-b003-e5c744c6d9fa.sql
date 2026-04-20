UPDATE custom_fields
SET options = '[
  {"color": "green", "label": "Pix", "value": "pix"},
  {"color": "blue", "label": "Cartão de crédito", "value": "cartao_credito"},
  {"color": "yellow", "label": "Pix + Cartão de crédito", "value": "opt_1768604267839"},
  {"color": "green", "label": "Pix + Cheques", "value": "pix_cheques"},
  {"color": "gray", "label": "Transferência Internacional", "value": "transferencia_bancaria"},
  {"color": "purple", "label": "Cartão recorrência", "value": "cartao_recorrencia"},
  {"color": "yellow", "label": "Cartão + Boleto parcelado", "value": "cartao_boleto_parcelado"},
  {"color": "yellow", "label": "Pix + Boleto parcelado", "value": "pix_boleto_parcelado"},
  {"color": "blue", "label": "Pix + Cartão + Cheques", "value": "pix_cartao_cheques"},
  {"color": "blue", "label": "Cartão + Cheques", "value": "cartao_cheques"},
  {"color": "orange", "label": "Cheques", "value": "cheques"}
]'::jsonb
WHERE id = 'b2cd2366-b990-43d9-a0b7-1b567fbed729';