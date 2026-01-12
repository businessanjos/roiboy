-- Enable RLS on composition_templates (system templates - read-only for all authenticated users)
ALTER TABLE public.composition_templates ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read system templates
CREATE POLICY "Authenticated users can view system templates"
ON public.composition_templates FOR SELECT
TO authenticated
USING (true);