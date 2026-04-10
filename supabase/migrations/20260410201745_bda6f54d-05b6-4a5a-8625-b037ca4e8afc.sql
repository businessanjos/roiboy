-- 1. Move all 161 deals from Repescagem to Closer → Follow Up stage
UPDATE public.deals
SET pipeline_id = '4a96159e-c6a2-432f-8128-9ac345e58c18',
    stage_id = '76e4dadc-286b-4302-a6d0-59698f45b70d'
WHERE pipeline_id = '205ffb2f-ecba-40a2-a583-591205a24f66';

-- 2. Drop the SDR routing trigger
DROP TRIGGER IF EXISTS trg_enforce_sdr_pipeline_routing ON public.deals;

-- 3. Drop the SDR routing function
DROP FUNCTION IF EXISTS public.enforce_sdr_pipeline_routing();

-- 4. Delete Repescagem stages (CASCADE from pipeline delete would handle this, but being explicit)
DELETE FROM public.deal_stages
WHERE pipeline_id = '205ffb2f-ecba-40a2-a583-591205a24f66';

-- 5. Delete the Repescagem pipeline permanently
DELETE FROM public.pipelines
WHERE id = '205ffb2f-ecba-40a2-a583-591205a24f66';