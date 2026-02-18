
-- Step 1: Delete duplicate contracts, keeping only the most recent per deal_id
DELETE FROM public.client_contracts
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (PARTITION BY deal_id ORDER BY created_at DESC) as rn
    FROM public.client_contracts
    WHERE deal_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- Step 2: Create partial unique index on deal_id (only for non-null values)
CREATE UNIQUE INDEX idx_unique_deal_contract ON public.client_contracts (deal_id) WHERE deal_id IS NOT NULL;
