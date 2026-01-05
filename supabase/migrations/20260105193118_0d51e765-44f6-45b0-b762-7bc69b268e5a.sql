-- Add new columns for link type
ALTER TABLE public.playbook_items 
ADD COLUMN IF NOT EXISTS link_url text,
ADD COLUMN IF NOT EXISTS link_title text,
ADD COLUMN IF NOT EXISTS link_description text;

-- Add new columns for template type
ALTER TABLE public.playbook_items 
ADD COLUMN IF NOT EXISTS template_header text,
ADD COLUMN IF NOT EXISTS template_body text,
ADD COLUMN IF NOT EXISTS template_footer text,
ADD COLUMN IF NOT EXISTS template_buttons jsonb DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.playbook_items.template_buttons IS 'Array of button objects: {type: "quick_reply"|"url"|"phone", text: string, value?: string}';