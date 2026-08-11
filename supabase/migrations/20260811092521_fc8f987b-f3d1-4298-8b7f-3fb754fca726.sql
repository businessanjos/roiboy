update insights_visuals set layout = jsonb_build_object('i',id::text,'scale',48,'x',x,'y',y,'w',w,'h',h) from (values
('74986ee8-e80a-4100-893b-5f355aa198d5'::uuid,0,47,48,14),
('c42c8157-e2e7-4b1b-a29b-ea6a02ddf510'::uuid,0,61,48,22)
) as v(vid,x,y,w,h)
where insights_visuals.id = v.vid;