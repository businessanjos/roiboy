-- Add column to store which stages require this field
ALTER TABLE public.custom_fields 
ADD COLUMN IF NOT EXISTS required_stages JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.custom_fields.required_stages IS 'Array of stage IDs where this field is required. ["all"] = required in all stages, ["stage_id_1", "stage_id_2"] = required only in those stages, NULL = not stage-specific';