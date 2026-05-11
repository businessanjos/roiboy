UPDATE public.cs_incentive_tiers SET label = 'Não atinge — zera o bônus'     WHERE bonus_multiplier = 0;
UPDATE public.cs_incentive_tiers SET label = 'Parcial — 60% do bônus'         WHERE bonus_multiplier = 0.6;
UPDATE public.cs_incentive_tiers SET label = 'Quase lá — 80% do bônus'        WHERE bonus_multiplier = 0.8;
UPDATE public.cs_incentive_tiers SET label = 'Meta atingida — 100% do bônus'  WHERE bonus_multiplier = 1;
UPDATE public.cs_incentive_tiers SET label = 'Acelerador — 120% do bônus'     WHERE bonus_multiplier = 1.2;
UPDATE public.cs_incentive_tiers SET label = 'Turbo — 140% do bônus'          WHERE bonus_multiplier = 1.4;