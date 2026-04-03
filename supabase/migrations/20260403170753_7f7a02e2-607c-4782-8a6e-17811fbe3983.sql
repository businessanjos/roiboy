
UPDATE insights_visuals 
SET title = 'Vendas/Leads',
    config = jsonb_set(
      jsonb_set(config, '{gaugeConfig}', '{"subType": "sales_leads"}'),
      '{appearance,fontScale}', '"xlarge"'
    )
WHERE id = 'f93ca073-2535-406e-a0e4-122b97aba166';

DELETE FROM insights_visuals WHERE id = 'cadf959f-964b-47bc-9181-2e67995be43d';
