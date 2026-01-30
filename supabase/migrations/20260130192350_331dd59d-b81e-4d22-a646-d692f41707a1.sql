-- Create form_fields table for form-specific custom fields
CREATE TABLE public.form_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  field_id uuid NOT NULL REFERENCES public.custom_fields(id) ON DELETE CASCADE,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(form_id, field_id)
);

-- Enable RLS
ALTER TABLE public.form_fields ENABLE ROW LEVEL SECURITY;

-- RLS policies using existing helper function
CREATE POLICY "Users can view form_fields in their account"
ON public.form_fields FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.forms f
    WHERE f.id = form_fields.form_id
    AND f.account_id = public.get_my_account_id()
  )
);

CREATE POLICY "Users can insert form_fields in their account"
ON public.form_fields FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.forms f
    WHERE f.id = form_fields.form_id
    AND f.account_id = public.get_my_account_id()
  )
);

CREATE POLICY "Users can update form_fields in their account"
ON public.form_fields FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.forms f
    WHERE f.id = form_fields.form_id
    AND f.account_id = public.get_my_account_id()
  )
);

CREATE POLICY "Users can delete form_fields in their account"
ON public.form_fields FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.forms f
    WHERE f.id = form_fields.form_id
    AND f.account_id = public.get_my_account_id()
  )
);

-- Create index for faster lookups
CREATE INDEX idx_form_fields_form_id ON public.form_fields(form_id);
CREATE INDEX idx_form_fields_field_id ON public.form_fields(field_id);

-- Migrate existing data from forms.fields JSON array to form_fields table
INSERT INTO public.form_fields (form_id, field_id, display_order)
SELECT 
  f.id as form_id,
  (elem#>>'{}')::uuid as field_id,
  (row_number() OVER (PARTITION BY f.id ORDER BY ord))::integer as display_order
FROM public.forms f,
  jsonb_array_elements(f.fields) WITH ORDINALITY AS t(elem, ord)
WHERE jsonb_typeof(f.fields) = 'array'
  AND f.fields != '[]'::jsonb
  AND f.fields IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.custom_fields cf WHERE cf.id = (elem#>>'{}')::uuid
  )
ON CONFLICT (form_id, field_id) DO NOTHING;