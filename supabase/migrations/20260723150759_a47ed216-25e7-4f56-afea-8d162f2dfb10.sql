
WITH orphans AS (
  SELECT
    a.id AS assignment_id,
    a.zapp_conversation_id,
    a.department_id AS current_dept,
    zc.sector_id AS conv_sector,
    (SELECT d.id FROM public.zapp_departments d
       WHERE d.sector_id = zc.sector_id
       ORDER BY d.created_at ASC LIMIT 1) AS target_dept
  FROM public.zapp_conversation_assignments a
  JOIN public.zapp_conversations zc ON zc.id = a.zapp_conversation_id
  WHERE zc.sector_id IS NOT NULL
    AND a.department_id IS NOT NULL
    AND a.status <> 'closed'
    AND NOT EXISTS (
      SELECT 1 FROM public.zapp_departments d
      WHERE d.id = a.department_id AND d.sector_id = zc.sector_id
    )
),
-- Se já existe QUALQUER assignment no depto correto para a mesma conversa,
-- fechar o órfão (senão viola o índice único).
to_close AS (
  SELECT o.assignment_id
  FROM orphans o
  WHERE o.target_dept IS NULL
     OR EXISTS (
       SELECT 1 FROM public.zapp_conversation_assignments other
       WHERE other.zapp_conversation_id = o.zapp_conversation_id
         AND other.id <> o.assignment_id
         AND other.department_id = o.target_dept
     )
),
closed AS (
  UPDATE public.zapp_conversation_assignments a
  SET status = 'closed',
      closed_at = COALESCE(a.closed_at, now()),
      updated_at = now()
  FROM to_close c
  WHERE a.id = c.assignment_id
  RETURNING a.id
),
moved AS (
  UPDATE public.zapp_conversation_assignments a
  SET department_id = o.target_dept,
      updated_at = now()
  FROM orphans o
  WHERE a.id = o.assignment_id
    AND o.target_dept IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM to_close c WHERE c.assignment_id = o.assignment_id)
  RETURNING a.id
)
SELECT
  (SELECT count(*) FROM closed) AS closed_count,
  (SELECT count(*) FROM moved) AS moved_count;

-- Trigger para manter consistência quando o setor da conversa muda
CREATE OR REPLACE FUNCTION public.sync_zapp_assignment_department_on_sector_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_dept uuid;
BEGIN
  IF NEW.sector_id IS DISTINCT FROM OLD.sector_id AND NEW.sector_id IS NOT NULL THEN
    SELECT d.id INTO v_target_dept
    FROM public.zapp_departments d
    WHERE d.sector_id = NEW.sector_id
    ORDER BY d.created_at ASC
    LIMIT 1;

    IF v_target_dept IS NOT NULL THEN
      -- Fecha assignments em departamentos divergentes quando não podem ser movidos
      -- (colidiriam com outro assignment já existente no depto correto)
      UPDATE public.zapp_conversation_assignments a
      SET status = 'closed', closed_at = now(), updated_at = now()
      WHERE a.zapp_conversation_id = NEW.id
        AND a.status <> 'closed'
        AND a.department_id IS DISTINCT FROM v_target_dept
        AND EXISTS (
          SELECT 1 FROM public.zapp_conversation_assignments b
          WHERE b.zapp_conversation_id = NEW.id
            AND b.department_id = v_target_dept
            AND b.id <> a.id
        );

      -- Move o restante
      UPDATE public.zapp_conversation_assignments a
      SET department_id = v_target_dept, updated_at = now()
      WHERE a.zapp_conversation_id = NEW.id
        AND a.status <> 'closed'
        AND a.department_id IS DISTINCT FROM v_target_dept;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_zapp_assignment_dept ON public.zapp_conversations;
CREATE TRIGGER trg_sync_zapp_assignment_dept
AFTER UPDATE OF sector_id ON public.zapp_conversations
FOR EACH ROW
EXECUTE FUNCTION public.sync_zapp_assignment_department_on_sector_change();
