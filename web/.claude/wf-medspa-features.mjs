export const meta = {
  name: 'medspa-three-features',
  description: 'Featured toggle + independent treatment/concern editing + concern doctor cards',
  phases: [
    { title: 'Featured' },
    { title: 'Concerns API' },
    { title: 'Wire UI' },
    { title: 'Verify' },
  ],
};

const ROOT = '/Users/devsharma/Developer/medspa-map/web';

const SHARED = `
Repo root: ${ROOT}. This is a Next.js app (a CUSTOMIZED fork — follow EXISTING patterns in
neighbouring files for route handlers, server components, and \`params\` being a Promise; do not
invent new conventions). Data layer is raw \`pg\` Pool (NOT Prisma); import the shared pool the same
way neighbouring files do (look for "@/lib/db" or similar). Match the existing code style, imports,
and Tailwind class conventions of the file you edit.

DB facts (migrations already applied — do NOT write migrations):
- clinics has columns: featured (boolean), verified (boolean), tier, avg_rating, review_count, is_active.
- clinic_services(id, clinic_id, service_id, raw_name, match_status, match_confidence, is_active, ...).
- services(id, name, slug, ...) = canonical 15 priority treatments.
- concerns(id, name, slug, ...) = canonical 10 priority conditions.
- concern_services(concern_id, service_id, display_order) = curated taxonomy concern↔service map.
- providers(id, clinic_id, name, title, bio, image_url, years_experience, is_verified, highlights,
  credentials, specialties, is_active). provider_services(provider_id, service_id→clinic_services.id).
- clinic_concerns(id, clinic_id, concern_id, source TEXT, is_active BOOLEAN, ...) UNIQUE(clinic_id,concern_id).
  source = 'manual' (admin added a concern) or 'removed' (admin suppressed an otherwise-derived concern).

Canonical taxonomy lives in src/lib/taxonomy/canonical.ts (CANONICAL_SERVICES, CANONICAL_CONCERNS,
concernsTreatedBy). Coverage helper: src/lib/treatments/coverage.ts.

CONCERN OVERRIDE MODEL (use everywhere concerns are computed):
- DERIVED concerns for a clinic = CANONICAL_CONCERNS whose serviceSlugs intersect the clinic's matched
  canonical service slugs (this is what deriveConcernServicesForClinic in src/lib/admin/clinic-save.ts
  already computes — reuse / mirror it).
- EFFECTIVE concerns = (DERIVED ∪ active source='manual') MINUS (active source='removed').
- When an admin saves a desired concern-slug set S, persist RELATIVE to DERIVED D:
    additions = S − D  → upsert clinic_concerns source='manual', is_active=true
    removals  = D − S  → upsert clinic_concerns source='removed', is_active=true
    any clinic_concerns row for this clinic whose concern is NOT in (additions ∪ removals) → set is_active=false
  Recompute cleanly on every save. Upserts use ON CONFLICT (clinic_id, concern_id).

Do NOT run \`next build\`, \`next dev\`, or any DB-mutating script. Do NOT start servers. Only edit source.
Report exactly which files you changed and a 1-line note per file.`;

const CHANGELOG = {
  type: 'object',
  additionalProperties: false,
  required: ['files_changed', 'summary'],
  properties: {
    files_changed: { type: 'array', items: { type: 'string' }, description: 'repo-relative paths edited/created' },
    summary: { type: 'string' },
    follow_ups: { type: 'array', items: { type: 'string' }, description: 'anything left for a later phase or that needs manual review' },
  },
};

// ── Phase 1: Featured (Task 2) ────────────────────────────────────────────────
phase('Featured');
const t2 = await agent(`${SHARED}

TASK 2 — Featured clinic toggle that floats featured clinics to the top everywhere.

The \`featured\` boolean already exists on clinics; the search API (src/app/api/search/route.ts) already
orders by it (verify, change nothing there). You must:

1. src/app/admin/(protected)/components/clinics-table.tsx — add \`featured: boolean\` to the Clinic
   interface; add a "Featured" column (header placed right after the Status column). Render a toggle
   control (a star/badge button, styled to match the existing Enable/Disable action). Clicking it PATCHes
   /api/admin/clinics/{id} with { featured: !featured } using the SAME admin fetch helper the file already
   uses for the active toggle, and optimistically updates local row state.
2. src/app/admin/(protected)/clinics/page.tsx — ensure the list item type includes \`featured\` and it flows
   into the table. Check src/app/api/admin/clinics/route.ts (GET list) actually SELECTs cl.featured; if not,
   add it to the SELECT and to the returned shape.
3. src/app/api/admin/clinics/[id]/route.ts — add \`featured: z.boolean().optional()\` to the PATCH zod schema
   and include it in the UPDATE statement (mirror how is_active is handled).
4. src/lib/treatments/queries.ts — the clinic listing query (~line 80) does not SELECT cl.featured: add it.
   Then in BOTH JS sort branches (~lines 135-155) sort featured DESC FIRST (before the existing verified
   check). e.g. \`if (a.featured !== b.featured) return a.featured ? -1 : 1;\` ahead of the verified comparison.
5. src/lib/concerns/queries.ts — the DISTINCT ON clinic listing query (~line 68) does not SELECT cl.featured:
   add it. Then in the clinic sort (~lines 93-96) sort featured DESC FIRST before verified.

Read each file fully before editing. Keep types consistent (featured may arrive as boolean).`,
  { phase: 'Featured', schema: CHANGELOG, label: 'task2-featured' });

// ── Phase 2: Concerns/treatments backend (Task 1 backend) ─────────────────────
phase('Concerns API');
const t1b = await agent(`${SHARED}

TASK 1 (BACKEND) — persist independent treatment AND concern editing for a clinic.

Treatments are ALREADY persisted via PUT /api/admin/clinics/[id]/services (service_slugs array). Leave
that route working but read it as the pattern reference (auth, params Promise, zod, pool, upsert).

Do:
1. Create a shared helper module src/lib/concerns/clinic-concerns.ts exporting:
   - getClinicMatchedServiceSlugs(clinicId): canonical service slugs the clinic currently offers.
   - deriveConcernSlugs(matchedServiceSlugs): the DERIVED concern slugs (reuse CANONICAL_CONCERNS logic;
     factor out / mirror deriveConcernServicesForClinic in src/lib/admin/clinic-save.ts).
   - getEffectiveConcernSlugs(clinicId): EFFECTIVE concern slugs per the override model (derived ∪ manual − removed).
   - saveClinicConcerns(clinicId, desiredConcernSlugs, client?): persists overrides RELATIVE to derived per the
     override model (additions=manual, removals=removed, deactivate stale). Accept an optional pg client so it
     can run inside an existing transaction (used by the save bundle). Resolve slugs→ids via the concerns table.
2. Create route src/app/api/admin/clinics/[id]/concerns/route.ts:
   - GET → { effective_concern_slugs, derived_concern_slugs }.
   - PUT { concern_slugs: string[] } → calls saveClinicConcerns, returns the new effective set.
   Mirror the auth + structure of src/app/api/admin/clinics/[id]/services/route.ts exactly.
3. src/app/api/admin/clinics/[id]/route.ts GET — add \`effective_concern_slugs\` (and the clinic's matched
   treatment service_slugs if not already present) to the returned clinic payload so the edit page can
   preload both. (NOTE: phase 'Featured' already added the PATCH featured field to this same file — preserve it.)
4. src/lib/admin/clinic-save.ts + src/app/api/admin/clinics/save/route.ts — accept OPTIONAL
   treatment_slugs?: string[] and concern_slugs?: string[] on the clinic bundle. After the clinic + services
   are written inside the existing transaction: if treatment_slugs provided, ensure those canonical
   clinic_services rows exist (matched, confidence 1) the same way the services PUT route does; if
   concern_slugs provided, call saveClinicConcerns(clinicId, concern_slugs, client). Keep existing
   auto-derive behaviour as the default when the new fields are absent (back-compat).
5. src/lib/concerns/queries.ts — the PUBLIC concern→clinic listing currently joins concern_services→
   clinic_services→clinics (= derived membership). Change it so a clinic appears for a concern when it is
   EFFECTIVE: derived (existing join) OR has an active clinic_concerns(source='manual') row, AND excluding
   clinics that have an active clinic_concerns(source='removed') row for that concern. Implement as a UNION
   of the two clinic sources with a NOT EXISTS (...source='removed'...) filter. Preserve the featured-first +
   verified + rating ordering that phase 'Featured' just added to this file (read the current file first).

Read every file fully before editing. Keep everything type-safe and idempotent.`,
  { phase: 'Concerns API', schema: CHANGELOG, label: 'task1-backend' });

// ── Phase 3: UI wiring (Task 1 frontend ∥ Task 3 doctors) ─────────────────────
phase('Wire UI');
const [t1f, t3] = await parallel([
  () => agent(`${SHARED}

TASK 1 (FRONTEND) — make treatments AND concerns independently add/removable in the admin
"Priority treatment coverage" card, on BOTH the new-clinic and edit-clinic pages.

Backend is DONE (phase 'Concerns API'):
- GET /api/admin/clinics/[id] now returns effective_concern_slugs (+ treatment service_slugs).
- PUT /api/admin/clinics/[id]/concerns { concern_slugs } persists concerns.
- PUT /api/admin/clinics/[id]/services { service_slugs } persists treatments (existing).
- The save bundle (POST /api/admin/clinics/save) now accepts treatment_slugs[] and concern_slugs[].
- src/lib/concerns/clinic-concerns.ts exports getEffectiveConcernSlugs etc.

Reference the target UI (the user's screenshot): the card has OFFERED treatments (green, click to remove),
NOT OFFERED treatments (click to add), and TREATS THESE CONCERNS chips. Make BOTH treatments and concerns
add/removable, INDEPENDENTLY.

1. src/lib/treatments/coverage.ts — add a function (keep computePriorityCoverage intact for back-compat)
   e.g. computeEditableCoverage(treatmentSlugs, concernSlugs) returning: present/missing treatments (from
   CANONICAL_SERVICES vs treatmentSlugs) AND present/missing concerns (from CANONICAL_CONCERNS vs the
   explicit concernSlugs set — NOT derived). The card's concern section must reflect the admin's explicit
   selection, not the auto-derived set.
2. src/app/admin/(protected)/clinics/[id]/edit/page.tsx — it already has selectedTreatmentSlugs with
   addTreatment/removeTreatment. Add selectedConcernSlugs state, preload it from the clinic GET
   (effective_concern_slugs), and addConcern/removeConcern handlers (mirror the treatment ones, markDirty).
   Make the "Treats these concerns" chips removable and add an "add concern" row listing CANONICAL_CONCERNS
   not currently selected (mirror the not-offered-treatments add UI). On save, in addition to the existing
   services PUT, call adminPut(\`/clinics/\${id}/concerns\`, { concern_slugs: selectedConcernSlugs }). Use
   computeEditableCoverage for the card display.
3. src/app/admin/(protected)/clinics/new/page.tsx — add explicit selectedTreatmentSlugs + selectedConcernSlugs
   state with the same add/remove chip UI (the priority-treatment coverage card here is currently read-only,
   inferred from service mappings — make it editable). Include treatment_slugs and concern_slugs in
   buildPayload so they post to /api/admin/clinics/save. Keep service-mapping behaviour intact.

Read each file fully first. Match the existing JSX/Tailwind patterns in those pages (the chip buttons,
section headers, dirty-tracking). Do not touch backend files.`,
    { phase: 'Wire UI', schema: CHANGELOG, label: 'task1-frontend' }),

  () => agent(`${SHARED}

TASK 3 — render real doctor cards on the public Concern page's "Doctors & Providers" tab.

Currently src/app/conditions/[slug]/concern-tabs.tsx renders \`<Empty label="Provider profiles for this
concern are coming soon." />\` for the "Doctors & Providers" tab. Replace it with a grid of real doctor cards.

Data source: providers at clinics that treat the concern. Use this query shape (returns 5-11 providers
per concern):
  SELECT DISTINCT ON (pr.id)
    pr.id, pr.name, pr.title, pr.image_url, pr.years_experience, pr.is_verified,
    cl.slug AS clinic_slug, cl.name AS clinic_name, cl.featured, cl.verified, cl.avg_rating
  FROM concern_services cs
  JOIN clinic_services cls ON cls.service_id = cs.service_id AND cls.is_active = true
  JOIN clinics cl ON cl.id = cls.clinic_id AND cl.is_active = true
  JOIN providers pr ON pr.clinic_id = cl.id AND pr.is_active = true
  WHERE cs.concern_id = $1
  ORDER BY pr.id
Then in JS sort featured DESC, then is_verified DESC, then avg_rating DESC, and cap to ~12.

Do:
1. src/lib/providers/queries.ts — add getProvidersByConcernId(concernId: string) using the query above.
   Return a typed list (id, name, title, image_url, years_experience, is_verified, clinic_slug, clinic_name,
   avg_rating). Build the provider profile href the SAME way the existing provider links do — inspect
   src/app/providers/[id]/[slug]/page.tsx and any existing provider link to copy the id/slug URL convention.
2. src/lib/concerns/queries.ts getConcernData — also fetch providers (call getProvidersByConcernId(c.id))
   and include them in the returned object as \`providers\`. (Phase 'Featured'/'Concerns API' also edit this
   file — read current contents first, add minimally, don't disturb their changes.)
3. src/app/conditions/[slug]/page.tsx — pass providers through to ConcernTabs (via its data prop).
4. src/app/api/concerns/[slug]/route.ts — include providers in the JSON response and counts.
5. src/app/conditions/[slug]/concern-tabs.tsx — accept providers in the data prop type; replace the Empty
   placeholder for "Doctors & Providers" with a responsive card grid matching the user's screenshot:
   photo, name (+ verified badge), title, "10+ YEARS OF EXPERIENCE" style line, star rating, and a
   "View Profile" button linking to the provider profile. REUSE the card visual style from
   src/components/hero/providers-spotlight.tsx (ProviderCard) — match its look. If providers is empty, keep
   a graceful Empty fallback.

Read each file fully first. Match existing JSX/Tailwind. Do not touch admin files or backend save logic.`,
    { phase: 'Wire UI', schema: CHANGELOG, label: 'task3-doctors' }),
]);

// ── Phase 4: Verify (lint + typecheck) ────────────────────────────────────────
phase('Verify');
const verify = await agent(`${SHARED}

VERIFICATION ONLY — do not change feature behaviour; you MAY make small fixes to resolve type/lint errors
introduced by this change set.

Run, from ${ROOT}:
1. \`npx tsc --noEmit\` (if a tsconfig exists) — capture errors.
2. \`npm run lint\` — capture errors/warnings.

If there are type or lint ERRORS in files touched by this change set
(clinics-table, clinics/page, api/admin/clinics/[id], api/admin/clinics/[id]/concerns,
lib/treatments/queries, lib/concerns/queries, lib/concerns/clinic-concerns, lib/admin/clinic-save,
api/admin/clinics/save, clinics/[id]/edit, clinics/new, lib/treatments/coverage, lib/providers/queries,
conditions/[slug]/page, conditions/[slug]/concern-tabs, api/concerns/[slug]), FIX them minimally and
re-run until clean (or until only pre-existing unrelated errors remain). Report the final tsc/lint status
and any errors you could NOT fix (with file:line and message).`,
  { phase: 'Verify', schema: CHANGELOG, label: 'verify' });

return { t2, t1b, t1f, t3, verify };
