-- Função que cria a próxima tarefa Checkpoint automaticamente
CREATE OR REPLACE FUNCTION create_next_checkpoint_task()
RETURNS TRIGGER AS $$
DECLARE
  checkpoint_type_id uuid;
BEGIN
  -- Busca o ID do tipo "Checkpoint" para a mesma account
  SELECT id INTO checkpoint_type_id
  FROM activity_types
  WHERE name = 'Checkpoint' 
    AND account_id = NEW.account_id
    AND is_active = true
  LIMIT 1;

  -- Só processa se:
  -- 1. A tarefa é do tipo Checkpoint (e o tipo existe)
  -- 2. Foi recém-concluída (transição NULL -> não NULL)
  -- 3. Tem client_id (é tarefa de cliente)
  IF checkpoint_type_id IS NOT NULL
     AND NEW.activity_type_id = checkpoint_type_id 
     AND OLD.completed_at IS NULL 
     AND NEW.completed_at IS NOT NULL
     AND NEW.client_id IS NOT NULL
  THEN
    INSERT INTO internal_tasks (
      account_id,
      title,
      description,
      status,
      priority,
      due_date,
      client_id,
      assigned_to,
      created_by,
      activity_type_id
    ) VALUES (
      NEW.account_id,
      'Checkpoint',
      NEW.description,
      'pending',
      NEW.priority,
      (NEW.completed_at::date + INTERVAL '15 days')::date,
      NEW.client_id,
      NEW.assigned_to,
      NEW.created_by,
      NEW.activity_type_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger que chama a função após UPDATE na internal_tasks
CREATE TRIGGER trigger_checkpoint_recurrence
  AFTER UPDATE ON internal_tasks
  FOR EACH ROW
  EXECUTE FUNCTION create_next_checkpoint_task();