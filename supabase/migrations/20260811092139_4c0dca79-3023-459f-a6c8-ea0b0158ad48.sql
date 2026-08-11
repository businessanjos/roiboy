update insights_visuals set layout = jsonb_build_object('i',id::text,'scale',48,'x',x,'y',y,'w',w,'h',h) from (values
('349c9f62-ab0f-4de6-b137-7f3fec353aa4'::uuid,0,0,12,10),
('47328468-7a6a-40a1-ac82-e6d1edd59177'::uuid,12,0,12,10),
('3e82d403-7cf4-406b-8fb5-3a0437401b92'::uuid,24,0,12,10),
('f93ca073-2535-406e-a0e4-122b97aba166'::uuid,36,0,12,10),
('4c3859ec-0181-4a78-9b63-ecf06dcf5a46'::uuid,0,10,16,12),
('a8a496c5-1bb9-44ab-80c6-f80e4ba5478f'::uuid,16,10,16,12),
('986b52a5-2f8a-4fca-8a6a-d67fdcfc4bda'::uuid,32,10,16,12),
('14166e52-4ab3-4934-9a08-c0ca4f58d2eb'::uuid,0,22,48,26),
('74986ee8-e80a-4100-893b-5f355aa198d5'::uuid,0,48,48,14),
('c42c8157-e2e7-4b1b-a29b-ea6a02ddf510'::uuid,0,62,48,26)
) as v(vid,x,y,w,h)
where insights_visuals.id = v.vid;