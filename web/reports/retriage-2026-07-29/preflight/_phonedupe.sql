WITH p(ph) AS (VALUES
('2108320892')
,('2125852133')
,('2147483645')
,('2147483646')
,('2543081161')
,('3034040255')
,('3044252405')
,('3044252408')
,('3214755477')
,('3619916611')
,('3746986698')
,('4357535845')
,('4357537880')
,('6478035037')
,('7135393458')
,('7266001199')
,('8597777979')
,('8646531064')
,('9495486800')
,('9495486801')
) SELECT p.ph, c.slug, c.name, c.website FROM p JOIN clinics c ON
 right(regexp_replace(coalesce(c.phone,''),'[^0-9]','','g'),10)=p.ph
 UNION
 SELECT p.ph, c.slug, c.name, c.website FROM p JOIN clinic_locations l ON
 right(regexp_replace(coalesce(l.phone,''),'[^0-9]','','g'),10)=p.ph JOIN clinics c ON c.id=l.clinic_id;
