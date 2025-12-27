-- Function to generate recurring entries for the next period
CREATE OR REPLACE FUNCTION public.process_recurring_entries()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_entry RECORD;
  v_new_due_date DATE;
  v_count INTEGER := 0;
BEGIN
  -- Find recurring entries that need to generate the next occurrence
  FOR v_entry IN 
    SELECT fe.* 
    FROM public.financial_entries fe
    WHERE fe.is_recurring = true
      AND fe.recurrence_type IS NOT NULL
      AND fe.status != 'cancelled'
      AND (fe.recurrence_end_date IS NULL OR fe.recurrence_end_date > CURRENT_DATE)
      -- Check if we need to create a future entry (within 30 days ahead)
      AND NOT EXISTS (
        SELECT 1 FROM public.financial_entries child
        WHERE child.parent_entry_id = fe.id
          AND child.due_date > fe.due_date
          AND child.due_date <= CURRENT_DATE + INTERVAL '30 days'
      )
  LOOP
    -- Calculate next due date based on recurrence type
    v_new_due_date := CASE v_entry.recurrence_type
      WHEN 'weekly' THEN v_entry.due_date + INTERVAL '7 days'
      WHEN 'biweekly' THEN v_entry.due_date + INTERVAL '14 days'
      WHEN 'monthly' THEN v_entry.due_date + INTERVAL '1 month'
      WHEN 'quarterly' THEN v_entry.due_date + INTERVAL '3 months'
      WHEN 'semiannual' THEN v_entry.due_date + INTERVAL '6 months'
      WHEN 'annual' THEN v_entry.due_date + INTERVAL '1 year'
      ELSE v_entry.due_date + INTERVAL '1 month'
    END;
    
    -- Check if we should still generate (within 30 days and before end date)
    IF v_new_due_date <= CURRENT_DATE + INTERVAL '30 days' 
       AND (v_entry.recurrence_end_date IS NULL OR v_new_due_date <= v_entry.recurrence_end_date) THEN
      
      -- Create new entry
      INSERT INTO public.financial_entries (
        account_id,
        entry_type,
        description,
        amount,
        due_date,
        status,
        category_id,
        bank_account_id,
        client_id,
        contract_id,
        is_recurring,
        recurrence_type,
        recurrence_end_date,
        parent_entry_id,
        document_number,
        notes,
        currency,
        created_by
      ) VALUES (
        v_entry.account_id,
        v_entry.entry_type,
        v_entry.description,
        v_entry.amount,
        v_new_due_date,
        'pending',
        v_entry.category_id,
        v_entry.bank_account_id,
        v_entry.client_id,
        v_entry.contract_id,
        v_entry.is_recurring,
        v_entry.recurrence_type,
        v_entry.recurrence_end_date,
        v_entry.id,
        v_entry.document_number,
        v_entry.notes,
        v_entry.currency,
        v_entry.created_by
      );
      
      v_count := v_count + 1;
    END IF;
  END LOOP;
  
  RETURN v_count;
END;
$$;

-- Function to get recurring template entries
CREATE OR REPLACE FUNCTION public.get_recurring_templates(p_account_id uuid)
RETURNS TABLE (
  id uuid,
  description text,
  entry_type text,
  amount numeric,
  recurrence_type text,
  recurrence_end_date date,
  category_name text,
  client_name text,
  next_due_date date,
  total_generated integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    fe.id,
    fe.description,
    fe.entry_type,
    fe.amount,
    fe.recurrence_type,
    fe.recurrence_end_date,
    fc.name as category_name,
    c.full_name as client_name,
    (
      SELECT MAX(child.due_date) + 
        CASE fe.recurrence_type
          WHEN 'weekly' THEN INTERVAL '7 days'
          WHEN 'biweekly' THEN INTERVAL '14 days'
          WHEN 'monthly' THEN INTERVAL '1 month'
          WHEN 'quarterly' THEN INTERVAL '3 months'
          WHEN 'semiannual' THEN INTERVAL '6 months'
          WHEN 'annual' THEN INTERVAL '1 year'
          ELSE INTERVAL '1 month'
        END
      FROM public.financial_entries child
      WHERE (child.parent_entry_id = fe.id OR child.id = fe.id)
    )::date as next_due_date,
    (
      SELECT COUNT(*)::integer
      FROM public.financial_entries child
      WHERE child.parent_entry_id = fe.id
    ) as total_generated
  FROM public.financial_entries fe
  LEFT JOIN public.financial_categories fc ON fc.id = fe.category_id
  LEFT JOIN public.clients c ON c.id = fe.client_id
  WHERE fe.account_id = p_account_id
    AND fe.is_recurring = true
    AND fe.parent_entry_id IS NULL
    AND fe.status != 'cancelled'
  ORDER BY fe.description;
$$;