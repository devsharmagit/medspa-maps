--
-- web/db/seed.sql — the canonical public taxonomy: 22 treatments + 14 conditions.
--
-- WHAT THIS IS FOR: bootstrapping an EMPTY database. scripts/db-setup.ts applies
-- it only when `services` and `concerns` are both empty. It is NOT a convergence
-- tool and must never be applied to a populated catalog.
--
-- WHY THAT GUARD EXISTS: every statement here is ON CONFLICT DO NOTHING, which
-- prevents duplicates but does NOT prevent a row that was deliberately DELETEd
-- from being re-inserted. Before 2026-10-01 db-setup.ts ran this file on every
-- container boot, so each deploy silently restored the entire file. That is what
-- undid the 2026-09-30 production catalog purge: 63 junk rows came back as
-- is_active = true and went straight back into public search.
--
-- WHY IT IS EXACTLY 22 + 14: the 2026-09-06 reduction cut the public taxonomy to
-- a small flat list, extended to 22 treatments on 2026-09-12 (Cryotherapy, Red
-- Light Therapy, Hormone Therapy). The ingest path is a CLOSED catalog — it
-- resolves a scraped name onto an already-active row or drops it, and never
-- creates one (src/lib/taxonomy/catalog-policy.ts).
--
-- IF YOU ADD A ROW HERE you are changing the public taxonomy of the whole site.
-- Add it to src/lib/taxonomy/core-catalog.ts as well, or ingest will drop it.
-- Do not re-add surgical / day-spa / nail rows: they were removed on 2026-09-30
-- because they carried zero clinic links.
--
-- UUIDs match production (growthops-rds) so a fresh database is id-compatible.
-- Regenerated 2026-10-01 from the live canonical rows.
--
-- Treatments (22)
INSERT INTO public.services (id, name, slug, is_active, origin) VALUES ('14e456e3-aa0c-4057-8d6f-b75ded201cae', 'Body Contouring', 'body-contouring', true, 'seed') ON CONFLICT DO NOTHING;
INSERT INTO public.services (id, name, slug, is_active, origin) VALUES ('734f962f-5916-4990-b84c-2738ac7532c5', 'Botox®', 'botox', true, 'seed') ON CONFLICT DO NOTHING;
INSERT INTO public.services (id, name, slug, is_active, origin) VALUES ('1148cf9a-7640-43a4-b49c-96656d09a78e', 'Chemical Peels', 'chemical-peels', true, 'seed') ON CONFLICT DO NOTHING;
INSERT INTO public.services (id, name, slug, is_active, origin) VALUES ('2b700c73-bc8a-472f-82c3-0aaae640ef1d', 'Cryotherapy', 'cryotherapy', true, 'manual') ON CONFLICT DO NOTHING;
INSERT INTO public.services (id, name, slug, is_active, origin) VALUES ('32cb4064-2b95-45af-9100-742469976364', 'Dermal Fillers', 'dermal-fillers', true, 'seed') ON CONFLICT DO NOTHING;
INSERT INTO public.services (id, name, slug, is_active, origin) VALUES ('91f8b638-3fd0-45d9-ab96-24a0cfe513bf', 'Dysport®', 'dysport', true, 'ai') ON CONFLICT DO NOTHING;
INSERT INTO public.services (id, name, slug, is_active, origin) VALUES ('24f71862-07e5-4335-b89b-e3dcb89a32ee', 'Facials', 'facials', true, 'manual') ON CONFLICT DO NOTHING;
INSERT INTO public.services (id, name, slug, is_active, origin) VALUES ('308d8668-3337-43c6-a6ed-f6096f29d4c3', 'Hair Restoration', 'hair-restoration', true, 'ai') ON CONFLICT DO NOTHING;
INSERT INTO public.services (id, name, slug, is_active, origin) VALUES ('8a9fb2d0-9d5d-4b09-ba1a-cd456f35d0bc', 'Hormone Therapy', 'hormone-therapy', true, 'manual') ON CONFLICT DO NOTHING;
INSERT INTO public.services (id, name, slug, is_active, origin) VALUES ('2a461a03-54fa-4413-8d03-031a3ce121b2', 'HydraFacial®', 'hydrafacial', true, 'seed') ON CONFLICT DO NOTHING;
INSERT INTO public.services (id, name, slug, is_active, origin) VALUES ('59b16f6c-ef26-4e3b-b006-cd2f05a7d9e9', 'IPL Photofacial', 'ipl-photofacial', true, 'seed') ON CONFLICT DO NOTHING;
INSERT INTO public.services (id, name, slug, is_active, origin) VALUES ('7c49a9de-3ef9-43e3-89ad-d8c532465dd5', 'IV Therapy', 'iv-therapy', true, 'ai') ON CONFLICT DO NOTHING;
INSERT INTO public.services (id, name, slug, is_active, origin) VALUES ('a1232a0c-ddb8-4cf7-840e-c08b4be7825c', 'Laser Hair Removal', 'laser-hair-removal', true, 'seed') ON CONFLICT DO NOTHING;
INSERT INTO public.services (id, name, slug, is_active, origin) VALUES ('3e34866d-e05c-4cb7-9502-363016f61938', 'Laser Skin Resurfacing', 'laser-skin-resurfacing', true, 'seed') ON CONFLICT DO NOTHING;
INSERT INTO public.services (id, name, slug, is_active, origin) VALUES ('c1b64dac-c2c7-4a7f-810a-1bdd5632ca9e', 'Laser Treatments', 'laser-treatments', true, 'ai') ON CONFLICT DO NOTHING;
INSERT INTO public.services (id, name, slug, is_active, origin) VALUES ('02754cfe-b29f-44ad-a336-a88683ab7d5d', 'Lip Fillers', 'lip-fillers', true, 'manual') ON CONFLICT DO NOTHING;
INSERT INTO public.services (id, name, slug, is_active, origin) VALUES ('0cbaabfa-58ee-4dc6-bd69-bcaf9155a08d', 'Medical Weight Loss', 'medical-weight-loss', true, 'ai') ON CONFLICT DO NOTHING;
INSERT INTO public.services (id, name, slug, is_active, origin) VALUES ('5aa3d56e-44c9-47bd-ac2e-7f1fa80f531e', 'Microneedling', 'microneedling', true, 'seed') ON CONFLICT DO NOTHING;
INSERT INTO public.services (id, name, slug, is_active, origin) VALUES ('7288006a-eedb-4f76-82d7-d7dbf0e4d0df', 'PRP / PRF Therapy', 'prp-prf', true, 'seed') ON CONFLICT DO NOTHING;
INSERT INTO public.services (id, name, slug, is_active, origin) VALUES ('c9bfab75-b54d-4e5a-9368-bb54ad3e7c4d', 'Red Light Therapy', 'red-light-therapy', true, 'manual') ON CONFLICT DO NOTHING;
INSERT INTO public.services (id, name, slug, is_active, origin) VALUES ('c16b7a85-6574-4672-9444-f10a094c7313', 'RF Microneedling', 'rf-microneedling', true, 'ai') ON CONFLICT DO NOTHING;
INSERT INTO public.services (id, name, slug, is_active, origin) VALUES ('73b963f1-42ab-48a4-bc0f-340e9906adb0', 'Sculptra®', 'sculptra', true, 'ai') ON CONFLICT DO NOTHING;

-- Conditions (14)
INSERT INTO public.concerns (id, name, slug, is_active, origin) VALUES ('07f06a38-ee98-4052-8ded-dc2150021dd2', 'Acne', 'acne', true, 'ai') ON CONFLICT DO NOTHING;
INSERT INTO public.concerns (id, name, slug, is_active, origin) VALUES ('38fc4881-2467-4fc0-a2e0-01f1a606f6cc', 'Acne Scars', 'acne-scars', true, 'seed') ON CONFLICT DO NOTHING;
INSERT INTO public.concerns (id, name, slug, is_active, origin) VALUES ('d863d1b9-f0f9-482d-afc0-837ad34c4683', 'Dark Spots', 'dark-spots', true, 'ai') ON CONFLICT DO NOTHING;
INSERT INTO public.concerns (id, name, slug, is_active, origin) VALUES ('7b19a640-00e0-46a7-911d-1e132275d549', 'Facial Volume Loss', 'facial-volume-loss', true, 'manual') ON CONFLICT DO NOTHING;
INSERT INTO public.concerns (id, name, slug, is_active, origin) VALUES ('0f62edf0-f582-43c7-8525-3c5820c76207', 'Fine Lines', 'fine-lines', true, 'ai') ON CONFLICT DO NOTHING;
INSERT INTO public.concerns (id, name, slug, is_active, origin) VALUES ('bb66d7bf-9438-4bf5-a5de-2db97d87f9fe', 'Hair Loss', 'hair-loss', true, 'ai') ON CONFLICT DO NOTHING;
INSERT INTO public.concerns (id, name, slug, is_active, origin) VALUES ('00ee81f5-631c-45b5-85bb-21be511aad3a', 'Melasma', 'melasma', true, 'ai') ON CONFLICT DO NOTHING;
INSERT INTO public.concerns (id, name, slug, is_active, origin) VALUES ('655d145a-d892-461b-a934-462417f31e03', 'Pigmentation', 'pigmentation', true, 'ai') ON CONFLICT DO NOTHING;
INSERT INTO public.concerns (id, name, slug, is_active, origin) VALUES ('471278ed-11da-4a77-8e20-9c2185ac6880', 'Skin Laxity', 'skin-laxity', true, 'ai') ON CONFLICT DO NOTHING;
INSERT INTO public.concerns (id, name, slug, is_active, origin) VALUES ('e99d687d-fcbd-42a5-8025-6b0678239587', 'Sun Damage', 'sun-damage', true, 'seed') ON CONFLICT DO NOTHING;
INSERT INTO public.concerns (id, name, slug, is_active, origin) VALUES ('56afb94d-5953-4ba5-aada-f92f76661a32', 'Uneven Skin Texture', 'uneven-skin-texture', true, 'manual') ON CONFLICT DO NOTHING;
INSERT INTO public.concerns (id, name, slug, is_active, origin) VALUES ('bb437923-3d64-4848-aa8c-495effc994b8', 'Uneven Skin Tone', 'uneven-skin-tone', true, 'ai') ON CONFLICT DO NOTHING;
INSERT INTO public.concerns (id, name, slug, is_active, origin) VALUES ('9cd9828a-aff4-4524-b531-2cf1a19a640b', 'Veins', 'veins', true, 'manual') ON CONFLICT DO NOTHING;
INSERT INTO public.concerns (id, name, slug, is_active, origin) VALUES ('7e510d71-0b09-46e8-b86c-4950fff9f66b', 'Wrinkles', 'wrinkles', true, 'manual') ON CONFLICT DO NOTHING;
