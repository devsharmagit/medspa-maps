--
-- web/db/seed.sql — canonical Phase-0 taxonomy ONLY.
--
-- 15 services + 10 concerns: every row with origin='seed'.
-- AI-grown taxonomy (origin='ai') is NOT seeded — it is created at ingest time
-- and must not be baked into a fresh database.
--
-- There is no global concern<->service link table: concern_services was dropped
-- in the 2026-07-18 simplification and the mapping is now per-clinic
-- (clinic_service_concerns), populated by ingest.
--
-- Every statement is ON CONFLICT DO NOTHING: idempotent, re-runnable, never
-- duplicates. Applied by scripts/db-setup.ts, and safe via plain psql.
--
-- Regenerated from the curated database (see web/db/README.md).
--

INSERT INTO public.services (id, name, slug, is_active, created_at, updated_at, origin) VALUES ('14e456e3-aa0c-4057-8d6f-b75ded201cae', 'Body Contouring', 'body-contouring', true, '2026-06-24T09:02:19.142Z', '2026-06-24T13:01:15.991Z', 'seed') ON CONFLICT DO NOTHING;
INSERT INTO public.services (id, name, slug, is_active, created_at, updated_at, origin) VALUES ('734f962f-5916-4990-b84c-2738ac7532c5', 'Botox', 'botox', true, '2026-06-22T14:49:05.613Z', '2026-07-14T05:34:26.124Z', 'seed') ON CONFLICT DO NOTHING;
INSERT INTO public.services (id, name, slug, is_active, created_at, updated_at, origin) VALUES ('1148cf9a-7640-43a4-b49c-96656d09a78e', 'Chemical Peels', 'chemical-peels', true, '2026-06-22T14:49:05.613Z', '2026-07-14T05:53:03.639Z', 'seed') ON CONFLICT DO NOTHING;
INSERT INTO public.services (id, name, slug, is_active, created_at, updated_at, origin) VALUES ('e450ba93-b5af-46b9-b2b6-efdd41ba871d', 'CoolSculpting', 'coolsculpting', true, '2026-06-24T09:02:19.142Z', '2026-06-24T13:01:15.469Z', 'seed') ON CONFLICT DO NOTHING;
INSERT INTO public.services (id, name, slug, is_active, created_at, updated_at, origin) VALUES ('32cb4064-2b95-45af-9100-742469976364', 'Dermal Fillers', 'dermal-fillers', true, '2026-06-22T14:49:05.613Z', '2026-07-14T05:52:43.937Z', 'seed') ON CONFLICT DO NOTHING;
INSERT INTO public.services (id, name, slug, is_active, created_at, updated_at, origin) VALUES ('2a461a03-54fa-4413-8d03-031a3ce121b2', 'HydraFacial', 'hydrafacial', true, '2026-06-24T09:02:19.142Z', '2026-07-14T05:34:32.921Z', 'seed') ON CONFLICT DO NOTHING;
INSERT INTO public.services (id, name, slug, is_active, created_at, updated_at, origin) VALUES ('59b16f6c-ef26-4e3b-b006-cd2f05a7d9e9', 'IPL / Photofacial', 'ipl-photofacial', true, '2026-06-24T09:02:19.142Z', '2026-06-24T13:01:17.677Z', 'seed') ON CONFLICT DO NOTHING;
INSERT INTO public.services (id, name, slug, is_active, created_at, updated_at, origin) VALUES ('1cfe44ca-42ce-4cda-b0cc-26246c53a9d8', 'Kybella', 'kybella', true, '2026-06-22T14:49:05.613Z', '2026-07-14T05:52:47.549Z', 'seed') ON CONFLICT DO NOTHING;
INSERT INTO public.services (id, name, slug, is_active, created_at, updated_at, origin) VALUES ('a1232a0c-ddb8-4cf7-840e-c08b4be7825c', 'Laser Hair Removal', 'laser-hair-removal', true, '2026-06-22T14:49:05.613Z', '2026-07-14T04:34:19.582Z', 'seed') ON CONFLICT DO NOTHING;
INSERT INTO public.services (id, name, slug, is_active, created_at, updated_at, origin) VALUES ('3e34866d-e05c-4cb7-9502-363016f61938', 'Laser Skin Resurfacing', 'laser-skin-resurfacing', true, '2026-06-22T14:49:05.613Z', '2026-07-14T04:04:49.083Z', 'seed') ON CONFLICT DO NOTHING;
INSERT INTO public.services (id, name, slug, is_active, created_at, updated_at, origin) VALUES ('5aa3d56e-44c9-47bd-ac2e-7f1fa80f531e', 'Microneedling', 'microneedling', true, '2026-06-22T14:49:05.613Z', '2026-07-14T04:04:50.274Z', 'seed') ON CONFLICT DO NOTHING;
INSERT INTO public.services (id, name, slug, is_active, created_at, updated_at, origin) VALUES ('77fad708-78e9-411b-82bc-8d8a0b528460', 'PDO Threads', 'pdo-threads', true, '2026-06-22T14:49:05.613Z', '2026-07-13T07:57:56.280Z', 'seed') ON CONFLICT DO NOTHING;
INSERT INTO public.services (id, name, slug, is_active, created_at, updated_at, origin) VALUES ('7288006a-eedb-4f76-82d7-d7dbf0e4d0df', 'PRP (Platelet-Rich Plasma)', 'prp-prf', true, '2026-06-22T14:49:05.613Z', '2026-07-14T04:40:52.186Z', 'seed') ON CONFLICT DO NOTHING;
INSERT INTO public.services (id, name, slug, is_active, created_at, updated_at, origin) VALUES ('3e6a118b-aed6-43be-8200-27e7f41de7c5', 'RF Skin Tightening', 'rf-skin-tightening', true, '2026-06-24T09:02:19.142Z', '2026-06-24T13:01:17.199Z', 'seed') ON CONFLICT DO NOTHING;
INSERT INTO public.services (id, name, slug, is_active, created_at, updated_at, origin) VALUES ('5eff1b8a-9cbe-4d06-beb6-61df499750b4', 'Ultherapy', 'ultherapy', true, '2026-06-24T09:02:19.142Z', '2026-06-24T13:01:16.228Z', 'seed') ON CONFLICT DO NOTHING;

INSERT INTO public.concerns (id, name, slug, is_active, created_at, updated_at, origin) VALUES ('38fc4881-2467-4fc0-a2e0-01f1a606f6cc', 'Acne Scars', 'acne-scars', true, '2026-06-24T09:02:19.142Z', '2026-07-13T10:43:07.214Z', 'seed') ON CONFLICT DO NOTHING;
INSERT INTO public.concerns (id, name, slug, is_active, created_at, updated_at, origin) VALUES ('d30d4123-fbbb-4862-acbb-6e12347c2710', 'Dark Spots & Melasma', 'dark-spots-melasma', true, '2026-06-24T09:02:19.142Z', '2026-06-24T09:02:19.142Z', 'seed') ON CONFLICT DO NOTHING;
INSERT INTO public.concerns (id, name, slug, is_active, created_at, updated_at, origin) VALUES ('b9715e49-f29c-4e50-aa63-40046d1c1b19', 'Double Chin', 'double-chin-submental-fullness', true, '2026-06-22T14:49:05.613Z', '2026-06-24T10:20:28.575Z', 'seed') ON CONFLICT DO NOTHING;
INSERT INTO public.concerns (id, name, slug, is_active, created_at, updated_at, origin) VALUES ('86721a3e-dc92-49b6-bab6-0e02ea3712b8', 'Wrinkles & Fine Lines', 'fine-lines-wrinkles', true, '2026-06-22T14:49:05.613Z', '2026-07-13T10:43:07.214Z', 'seed') ON CONFLICT DO NOTHING;
INSERT INTO public.concerns (id, name, slug, is_active, created_at, updated_at, origin) VALUES ('60dc011c-e458-4676-8965-863ac7d19c2a', 'Hyperpigmentation', 'hyperpigmentation', true, '2026-06-24T09:02:19.142Z', '2026-07-13T10:43:07.214Z', 'seed') ON CONFLICT DO NOTHING;
INSERT INTO public.concerns (id, name, slug, is_active, created_at, updated_at, origin) VALUES ('8ab63fa4-92bc-4f1e-ab02-3bd3e62e93a9', 'Rosacea', 'rosacea', true, '2026-06-24T09:02:19.142Z', '2026-06-24T09:02:19.142Z', 'seed') ON CONFLICT DO NOTHING;
INSERT INTO public.concerns (id, name, slug, is_active, created_at, updated_at, origin) VALUES ('0eef1b52-1173-4024-99f2-2de9c6daa114', 'Loose & Sagging Skin', 'skin-laxity-sagging', true, '2026-06-22T14:49:05.613Z', '2026-07-13T10:43:07.214Z', 'seed') ON CONFLICT DO NOTHING;
INSERT INTO public.concerns (id, name, slug, is_active, created_at, updated_at, origin) VALUES ('c0ef6d55-dfc7-4ead-b962-3d8214bf94dd', 'Stretch Marks', 'stretch-marks', true, '2026-06-24T09:02:19.142Z', '2026-07-13T10:43:07.214Z', 'seed') ON CONFLICT DO NOTHING;
INSERT INTO public.concerns (id, name, slug, is_active, created_at, updated_at, origin) VALUES ('f47b94ca-f82f-4d7c-8c01-47d7a7c8debe', 'Stubborn Body Fat', 'stubborn-body-fat', true, '2026-06-24T09:02:19.142Z', '2026-06-24T09:02:19.142Z', 'seed') ON CONFLICT DO NOTHING;
INSERT INTO public.concerns (id, name, slug, is_active, created_at, updated_at, origin) VALUES ('e99d687d-fcbd-42a5-8025-6b0678239587', 'Sun Damage', 'sun-damage', true, '2026-06-24T09:02:19.142Z', '2026-06-24T10:20:27.868Z', 'seed') ON CONFLICT DO NOTHING;
