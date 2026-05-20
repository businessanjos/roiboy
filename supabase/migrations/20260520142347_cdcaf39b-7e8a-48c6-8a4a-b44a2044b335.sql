
CREATE OR REPLACE FUNCTION public.ensure_default_contratada(p_account_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contratada_id uuid;
  v_account record;
BEGIN
  -- Se já existe alguma contratada para a conta, garante que há uma padrão
  SELECT id INTO v_contratada_id
  FROM contratadas
  WHERE account_id = p_account_id AND is_default = true AND active = true
  LIMIT 1;

  IF v_contratada_id IS NOT NULL THEN
    -- garante account_settings apontando para ela
    UPDATE account_settings
    SET nfse_default_contratada_id = v_contratada_id
    WHERE account_id = p_account_id
      AND (nfse_default_contratada_id IS NULL OR nfse_default_contratada_id != v_contratada_id);
    RETURN v_contratada_id;
  END IF;

  -- pega qualquer contratada existente e marca como padrão
  SELECT id INTO v_contratada_id
  FROM contratadas
  WHERE account_id = p_account_id AND active = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_contratada_id IS NOT NULL THEN
    UPDATE contratadas SET is_default = true WHERE id = v_contratada_id;
    UPDATE account_settings SET nfse_default_contratada_id = v_contratada_id WHERE account_id = p_account_id;
    RETURN v_contratada_id;
  END IF;

  -- Não existe nenhuma — cria a partir de accounts
  SELECT * INTO v_account FROM accounts WHERE id = p_account_id;

  IF v_account.document IS NULL OR length(regexp_replace(v_account.document, '\D', '', 'g')) <> 14 THEN
    RAISE EXCEPTION 'A conta não tem um CNPJ válido cadastrado. Atualize em Configurações da conta.';
  END IF;

  INSERT INTO contratadas (
    account_id, cnpj, razao_social, nome_fantasia,
    endereco, regime_tributario, item_lista_servico, aliquota_iss,
    provider, is_default, active
  ) VALUES (
    p_account_id,
    regexp_replace(v_account.document, '\D', '', 'g'),
    v_account.name,
    v_account.name,
    jsonb_build_object(
      'street', v_account.street,
      'number', v_account.street_number,
      'complement', v_account.complement,
      'neighborhood', v_account.neighborhood,
      'city', v_account.city,
      'state', v_account.state,
      'zip', v_account.zip_code
    ),
    'simples_nacional',
    '8.02',
    NULL,
    'notazz',
    true,
    true
  )
  RETURNING id INTO v_contratada_id;

  -- garante row em account_settings
  INSERT INTO account_settings (account_id, nfse_default_contratada_id)
  VALUES (p_account_id, v_contratada_id)
  ON CONFLICT (account_id) DO UPDATE SET nfse_default_contratada_id = EXCLUDED.nfse_default_contratada_id;

  RETURN v_contratada_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_default_contratada(uuid) TO authenticated, service_role;
