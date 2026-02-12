

## Preencher "Data do primeiro contato" ao concluir tarefa

### Logica

Quando uma tarefa cujo titulo contenha "Primeiro Contato" for marcada como concluida (ou seja, `completed_at` mudar de NULL para um valor), o sistema preenchera automaticamente o campo personalizado "Data do primeiro contato" (ID: `166fe351-b29b-4f08-b330-88f82c65f625`) no negocio vinculado.

### Abordagem: Trigger no banco de dados

Usar um trigger no banco e a melhor opcao porque:
- Cobre **todos** os caminhos de conclusao (TaskDialog, TaskCard, pagina de Tarefas, API, edge functions)
- Nao depende de mudancas em multiplos componentes do frontend
- Execucao atomica e confiavel

### Detalhes tecnicos

**Migracao SQL: criar funcao + trigger**

```text
CREATE OR REPLACE FUNCTION sync_first_contact_date()
  RETURNS trigger AS $$
BEGIN
  -- Dispara apenas quando completed_at muda de NULL para um valor
  IF NEW.completed_at IS NOT NULL 
     AND (OLD.completed_at IS NULL)
     AND NEW.deal_id IS NOT NULL
     AND NEW.title ILIKE '%Primeiro Contato%' 
  THEN
    INSERT INTO deal_field_values (account_id, deal_id, field_id, value_date)
    VALUES (
      NEW.account_id,
      NEW.deal_id,
      '166fe351-b29b-4f08-b330-88f82c65f625',
      (NEW.completed_at AT TIME ZONE 'America/Sao_Paulo')::date
    )
    ON CONFLICT (deal_id, field_id)
    DO UPDATE SET value_date = (NEW.completed_at AT TIME ZONE 'America/Sao_Paulo')::date;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

CREATE TRIGGER trg_sync_first_contact_date
  AFTER UPDATE ON internal_tasks
  FOR EACH ROW
  EXECUTE FUNCTION sync_first_contact_date();
```

Pontos importantes:
- `AT TIME ZONE 'America/Sao_Paulo'` converte o timestamp UTC para o fuso horario correto antes de extrair a data, evitando o problema de datas adiantadas/atrasadas
- `ON CONFLICT ... DO UPDATE` garante idempotencia (upsert)
- `ILIKE '%Primeiro Contato%'` faz match case-insensitive com qualquer tarefa que contenha "Primeiro Contato" no titulo
- So dispara no `UPDATE` (quando `completed_at` passa de NULL para preenchido)

### Resultado esperado

- Ao marcar "Primeiro Contato Realizado" como concluida, o campo "Data do primeiro contato" sera preenchido automaticamente com a data correta no fuso de Sao Paulo
- Funciona independentemente de onde a tarefa for concluida (dialog, card, API)
- Nenhuma alteracao no frontend necessaria

### Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| Migracao SQL | Criar funcao `sync_first_contact_date` + trigger `trg_sync_first_contact_date` |
