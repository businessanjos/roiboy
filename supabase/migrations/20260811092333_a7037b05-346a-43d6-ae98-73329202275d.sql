update insights_visuals set layout = jsonb_build_object('i',id::text,'scale',48,'x',x,'y',y,'w',w,'h',h) from (values
('4c3859ec-0181-4a78-9b63-ecf06dcf5a46'::uuid,0,7,16,16),
('a8a496c5-1bb9-44ab-80c6-f80e4ba5478f'::uuid,16,7,16,16),
('986b52a5-2f8a-4fca-8a6a-d67fdcfc4bda'::uuid,32,7,16,16),
('14166e52-4ab3-4934-9a08-c0ca4f58d2eb'::uuid,0,23,48,24),
('74986ee8-e80a-4100-893b-5f355aa198d5'::uuid,0,47,48,12),
('c42c8157-e2e7-4b1b-a29b-ea6a02ddf510'::uuid,0,59,48,24)
) as v(vid,x,y,w,h)
where insights_visuals.id = v.vid;