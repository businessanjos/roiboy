UPDATE public.client_instagram_metrics_history h
SET total_likes = sub.total_likes,
    total_comments = sub.total_comments,
    posts_considered = sub.n
FROM (
  SELECT s.client_id,
         s.username,
         COALESCE(SUM((p->>'like_count')::int), 0) AS total_likes,
         COALESCE(SUM((p->>'comment_count')::int), 0) AS total_comments,
         COUNT(*) FILTER (WHERE p IS NOT NULL) AS n
  FROM public.client_instagram_snapshots s
  LEFT JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(s.posts) = 'array' THEN s.posts ELSE '[]'::jsonb END
  ) p ON true
  GROUP BY s.client_id, s.username
) sub
WHERE h.client_id = sub.client_id
  AND h.username = sub.username
  AND COALESCE(h.posts_considered, 0) = 0;