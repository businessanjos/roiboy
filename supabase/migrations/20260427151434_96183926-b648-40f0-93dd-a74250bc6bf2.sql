UPDATE insights_visuals
SET config = jsonb_set(
  config,
  '{fixedDateRange}',
  '{"startDate": "2025-01-01T03:00:00.000Z", "endDate": "2025-12-31T02:59:59.999Z"}'::jsonb
)
WHERE id = 'd1b897e0-05ef-41f5-8be2-1ca515c77a4a';