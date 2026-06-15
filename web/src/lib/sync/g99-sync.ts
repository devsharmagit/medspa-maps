/**
 * g99-sync.ts — business-first G99 sync pipeline.
 *
 * Flow per business:
 *   1. Fetch all valid G99 businesses (not deleted, not test accounts)
 *   2. For each business — pull ALL its data from G99 in one shot
 *   3. Compare against our DB — only write what actually changed
 *   4. Sync clinics → services → providers → reviews in that order
 *
 * G99 is the source of truth. We never write to it.
 * We never hard-delete — soft-delete (is_active = false) only.
 */

import { ourQuery, ourQueryOne, g99Query, g99QueryOne, slugify, uniqueSlug } from "./db-helpers";

// ─── G99 types ────────────────────────────────────────────────────────────────

interface G99Business {
  id: bigint;
  name: string;
  website: string | null;
  logo_url: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  timezone: string | null;
  instagram: string | null;
  facebook: string | null;
  about: string | null;
}

interface G99Clinic {
  id: bigint;
  tenant_id: bigint;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  contact_number: string | null;
  notification_email: string | null;
  website: string | null;
  appointment_url: string | null;
  about: string | null;
  instagram: string | null;
  facebook: string | null;
  google_place_id: string | null;
  google_my_business: string | null;
  yelp_url: string | null;
}

interface G99Hours {
  day_of_week: string;
  open_hour: string | null;
  close_hour: string | null;
  is_open: boolean;
}

interface G99ServiceClinic {
  id: bigint;
  service_id: bigint;
  service_name: string;
  service_category_id: bigint | null;
  category_name: string | null;
  cost: number | null;
  price_varies: boolean | null;
  service_cost_pre_text: string | null;
  service_cost_post_text: string | null;
  duration_in_minutes: number | null;
}

interface G99Provider {
  id: bigint;
  first_name: string;
  last_name: string;
  title: string | null;
  designation: string | null;
  description: string | null;
  profile_image_url: string | null;
  deleted: boolean;
  clinic_ids: bigint[];     // from user_clinic
  is_primary_clinic: boolean[];
  clinic_enabled: boolean[];
}

interface G99Review {
  id: bigint;
  ratings: number;
  message: string | null;
  channel: string;
}

/** Everything we need for one G99 business, fetched in one pass */
interface G99BusinessBundle {
  business: G99Business;
  clinics: Array<{
    clinic: G99Clinic;
    hours: Record<string, { open: string | null; close: string | null; is_open: boolean }>;
    services: G99ServiceClinic[];
    reviews: G99Review[];
  }>;
  providers: G99Provider[];
}

// ─── Our DB types (for comparison) ───────────────────────────────────────────

interface OurBusiness extends Record<string, unknown> {
  id: string;
  name: string;
  website_url: string | null;
  logo_url: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  timezone: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  about: string | null;
}

interface OurClinic extends Record<string, unknown> {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  booking_url: string | null;
  about: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  google_place_id: string | null;
  google_my_business: string | null;
  yelp_url: string | null;
  hours: string | null; // stored as JSON string
}

interface OurProvider extends Record<string, unknown> {
  id: string;
  name: string;
  title: string | null;
  designation: string | null;
  bio: string | null;
  photo_url: string | null;
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function syncG99(opts: { limit?: number } = {}): Promise<void> {
  console.log("── G99 Sync started ──────────────────────────────────────────");

  const allValid = await getValidG99Businesses();
  const businesses = opts.limit ? allValid.slice(0, opts.limit) : allValid;
console.log(businesses.length, "limit", opts.limit)
  if (opts.limit && allValid.length > opts.limit) {
    console.log(`  found ${allValid.length} valid G99 businesses — processing first ${opts.limit}`);
  } else {
    console.log(`  found ${businesses.length} valid G99 businesses`);
  }

  let synced = 0;
  let failed = 0;

  for (const biz of businesses) {
    try {
      const bundle = await fetchG99BusinessBundle(biz.id);
      await syncOneBusiness(bundle);
      synced++;
    } catch (err) {
      failed++;
      console.error(`  [ERROR] business g99_id=${biz.id} (${biz.name}): ${(err as Error).message}`);
    }
  }

  console.log(`── G99 Sync complete — ${synced} ok, ${failed} failed ─────────\n`);
}

// ─── Step 1: Get valid G99 businesses ─────────────────────────────────────────

async function getValidG99Businesses(): Promise<{ id: bigint; name: string }[]> {
  // Filter: not deleted + not a test business (via business_config)
  return g99Query<{ id: bigint; name: string }>(
    `SELECT b.id, b.name
     FROM businesses b
     JOIN business_config bc ON bc.tenant_id = b.id
     WHERE b.deleted = false
       AND bc.is_test_business = false
     ORDER BY b.id`
  );
}

// ─── Step 2: Fetch everything for one G99 business in one pass ────────────────

export async function fetchG99BusinessBundle(g99BusinessId: bigint): Promise<G99BusinessBundle> {
  // Business
  const business = await g99QueryOne<G99Business>(
    `SELECT id, name, website, logo_url, phone, address, city, state, country,
            timezone, instagram, facebook, about
     FROM businesses WHERE id = $1`,
    [g99BusinessId]
  );
  if (!business) throw new Error(`G99 business ${g99BusinessId} not found`);

  // Clinics for this business
  const g99Clinics = await g99Query<G99Clinic>(
    `SELECT id, tenant_id, name, address, city, state, contact_number,
            notification_email, website, appointment_url, about,
            instagram, facebook, google_place_id, google_my_business, yelp_url
     FROM clinics WHERE tenant_id = $1`,
    [g99BusinessId]
  );

  // Build clinic bundles
  const clinics: G99BusinessBundle["clinics"] = [];
  for (const clinic of g99Clinics) {
    const hours = await fetchClinicHours(clinic.id);
    const services = await fetchClinicServices(clinic.id);
    const reviews = await fetchClinicReviews(clinic.id);
    clinics.push({ clinic, hours, services, reviews });
  }

  // Providers for this business (active + deleted — we need deleted to soft-delete ours)
  const rawProviders = await g99Query<Omit<G99Provider, "clinic_ids" | "is_primary_clinic" | "clinic_enabled">>(
    `SELECT id, first_name, last_name, title, designation, description, profile_image_url, deleted
     FROM users
     WHERE tenant_id = $1 AND is_provider = true`,
    [g99BusinessId]
  );

  const providers: G99Provider[] = [];
  for (const p of rawProviders) {
    const assignments = await g99Query<{ clinic_id: bigint; is_provider_clinic: boolean; enabled: boolean }>(
      `SELECT clinic_id, is_provider_clinic, enabled
       FROM user_clinic WHERE user_id = $1 AND is_provider_clinic = true`,
      [p.id]
    );
    providers.push({
      ...p,
      clinic_ids: assignments.map((a) => a.clinic_id),
      is_primary_clinic: assignments.map((a) => a.is_provider_clinic),
      clinic_enabled: assignments.map((a) => a.enabled),
    });
  }

  return { business, clinics, providers };
}

async function fetchClinicHours(
  g99ClinicId: bigint
): Promise<Record<string, { open: string | null; close: string | null; is_open: boolean }>> {
  const rows = await g99Query<G99Hours>(
    `SELECT day_of_week, open_hour, close_hour, is_open
     FROM clinic_business_hours WHERE clinic_id = $1`,
    [g99ClinicId]
  );
  const hours: Record<string, { open: string | null; close: string | null; is_open: boolean }> = {};
  for (const row of rows) {
    hours[row.day_of_week.toUpperCase()] = {
      open: row.open_hour ?? null,
      close: row.close_hour ?? null,
      is_open: row.is_open,
    };
  }
  return hours;
}

async function fetchClinicServices(g99ClinicId: bigint): Promise<G99ServiceClinic[]> {
  return g99Query<G99ServiceClinic>(
    `SELECT
       sc.id, sc.service_id,
       s.name AS service_name, s.service_category_id,
       c.name AS category_name,
       s.cost, s.price_varies, s.service_cost_pre_text, s.service_cost_post_text,
       s.duration_in_minutes
     FROM service_clinic sc
     JOIN services s ON s.id = sc.service_id
     LEFT JOIN service_categories c ON c.id = s.service_category_id
     WHERE sc.clinic_id = $1`,
    [g99ClinicId]
  );
}

async function fetchClinicReviews(g99ClinicId: bigint): Promise<G99Review[]> {
  return g99Query<G99Review>(
    `SELECT id, ratings, message, channel
     FROM review_and_ratings WHERE clinic_id = $1`,
    [g99ClinicId]
  );
}

// ─── Step 3: Sync one business and all its children ───────────────────────────

export async function syncOneBusiness(bundle: G99BusinessBundle): Promise<void> {
  const { business, clinics, providers } = bundle;

  const ourBizId = await upsertBusiness(business);
  console.log(`  [business] ${business.name} (g99=${business.id} → our=${ourBizId})`);

  for (const { clinic, hours, services, reviews } of clinics) {
    const ourClinicId = await upsertClinic(clinic, hours, ourBizId);
    await syncClinicServices(services, ourClinicId);
    await syncReviews(reviews, ourClinicId);
  }

  await syncProviders(providers, ourBizId);
}

// ─── Business upsert ──────────────────────────────────────────────────────────

async function upsertBusiness(g: G99Business): Promise<string> {
  const existing = await ourQueryOne<OurBusiness>(
    `SELECT id, name, website_url, logo_url, phone, address, city, state, country,
            timezone, instagram_url, facebook_url, about
     FROM businesses WHERE g99_business_id = $1`,
    [g.id]
  );

  if (existing) {
    // Only update fields that actually changed
    const changed = fieldsDiff(existing, {
      name: g.name,
      website_url: g.website,
      logo_url: g.logo_url,
      phone: g.phone,
      address: g.address,
      city: g.city,
      state: g.state,
      country: g.country,
      timezone: g.timezone,
      instagram_url: g.instagram,
      facebook_url: g.facebook,
      about: g.about,
    });

    if (Object.keys(changed).length > 0) {
      const { sql, values } = buildUpdate(changed, existing.id);
      await ourQuery(
        `UPDATE businesses SET ${sql}, last_synced_at = NOW(), updated_at = NOW() WHERE id = $${values.length + 1}`,
        [...values, existing.id]
      );
    } else {
      // Still bump last_synced_at so we know the sync ran
      await ourQuery(
        "UPDATE businesses SET last_synced_at = NOW() WHERE id = $1",
        [existing.id]
      );
    }

    // Upsert logo
    if (g.logo_url) await upsertImage("business", existing.id, g.logo_url, "logo");

    return existing.id;
  }

  // New business — insert
  const slug = await uniqueSlug(slugify(g.name), "businesses");
  const row = await ourQueryOne<{ id: string }>(
    `INSERT INTO businesses (
       name, slug, website_url, logo_url, phone, address, city, state, country,
       timezone, instagram_url, facebook_url, about,
       tier, verified, verified_at,
       g99_business_id, g99_tenant_id, data_source, last_synced_at, is_active
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9,
       $10, $11, $12, $13,
       'featured', true, NOW(),
       $14, $14, 'g99', NOW(), true
     ) RETURNING id`,
    [
      g.name, slug, g.website, g.logo_url, g.phone,
      g.address, g.city, g.state, g.country,
      g.timezone, g.instagram, g.facebook, g.about,
      g.id,
    ]
  );
  const newId = row!.id;

  if (g.logo_url) await upsertImage("business", newId, g.logo_url, "logo");

  return newId;
}

// ─── Clinic upsert ────────────────────────────────────────────────────────────

async function upsertClinic(
  g: G99Clinic,
  hours: Record<string, unknown>,
  ourBizId: string
): Promise<string> {
  const existing = await ourQueryOne<OurClinic>(
    `SELECT id, name, address, city, state, phone, email, website, booking_url, about,
            instagram_url, facebook_url, google_place_id, google_my_business, yelp_url, hours::text AS hours
     FROM clinics WHERE g99_clinic_id = $1`,
    [g.id]
  );

  const hoursJson = JSON.stringify(hours);

  if (existing) {
    const changed = fieldsDiff(existing, {
      name: g.name,
      address: g.address,
      city: g.city,
      state: g.state,
      phone: g.contact_number,
      email: g.notification_email,
      website: g.website,
      booking_url: g.appointment_url,
      about: g.about,
      instagram_url: g.instagram,
      facebook_url: g.facebook,
      google_place_id: g.google_place_id,
      google_my_business: g.google_my_business,
      yelp_url: g.yelp_url,
    });

    // Hours comparison: compare JSON strings
    const hoursChanged = existing.hours !== hoursJson;

    if (Object.keys(changed).length > 0 || hoursChanged) {
      const allChanged = hoursChanged ? { ...changed, hours: hoursJson } : changed;
      const { sql, values } = buildUpdate(allChanged, existing.id);
      await ourQuery(
        `UPDATE clinics SET ${sql}, updated_at = NOW() WHERE id = $${values.length + 1}`,
        [...values, existing.id]
      );
    }

    return existing.id;
  }

  // New clinic
  const slug = await uniqueSlug(slugify(g.name), "clinics");
  const row = await ourQueryOne<{ id: string }>(
    `INSERT INTO clinics (
       business_id, name, slug, address, city, state, country,
       phone, email, website, booking_url, about,
       instagram_url, facebook_url, google_place_id, google_my_business, yelp_url,
       hours, tier, verified, featured, g99_clinic_id, data_source, is_active
     ) VALUES (
       $1, $2, $3, $4, $5, $6, 'US',
       $7, $8, $9, $10, $11,
       $12, $13, $14, $15, $16,
       $17, 'featured', true, true, $18, 'g99', true
     ) RETURNING id`,
    [
      ourBizId, g.name, slug,
      g.address, g.city, g.state,
      g.contact_number, g.notification_email, g.website, g.appointment_url, g.about,
      g.instagram, g.facebook, g.google_place_id, g.google_my_business, g.yelp_url,
      hoursJson, g.id,
    ]
  );
  return row!.id;
}

// ─── Clinic services ──────────────────────────────────────────────────────────

async function syncClinicServices(services: G99ServiceClinic[], ourClinicId: string): Promise<void> {
  for (const svc of services) {
    // Ensure category exists in our DB
    if (svc.service_category_id && svc.category_name) {
      await upsertCategory(svc.service_category_id, svc.category_name);
    }

    // Ensure service exists globally (deduplicated by slug)
    const ourSvcId = await upsertService(svc);
    if (!ourSvcId) continue;

    const priceNotes = [svc.service_cost_pre_text, svc.service_cost_post_text]
      .filter(Boolean)
      .join(" ") || null;

    await ourQuery(
      `INSERT INTO clinic_services
         (clinic_id, service_id, price_from, price_to, price_notes, price_varies, is_active, g99_service_clinic_id)
       VALUES ($1, $2, $3, $3, $4, $5, true, $6)
       ON CONFLICT (g99_service_clinic_id) DO UPDATE SET
         price_from   = EXCLUDED.price_from,
         price_to     = EXCLUDED.price_to,
         price_notes  = EXCLUDED.price_notes,
         price_varies = EXCLUDED.price_varies`,
      [ourClinicId, ourSvcId, svc.cost, priceNotes, svc.price_varies ?? false, svc.id]
    );
  }
}

async function upsertCategory(g99CategoryId: bigint, name: string): Promise<string> {
  const existing = await ourQueryOne<{ id: string }>(
    "SELECT id FROM categories WHERE g99_category_id = $1",
    [g99CategoryId]
  );
  if (existing) {
    await ourQuery(
      "UPDATE categories SET name = $1, updated_at = NOW() WHERE g99_category_id = $2",
      [name, g99CategoryId]
    );
    return existing.id;
  }
  const slug = await uniqueSlug(slugify(name), "categories");
  const row = await ourQueryOne<{ id: string }>(
    `INSERT INTO categories (name, slug, g99_category_id, is_active)
     VALUES ($1, $2, $3, true) RETURNING id`,
    [name, slug, g99CategoryId]
  );
  return row!.id;
}

async function upsertService(svc: G99ServiceClinic): Promise<string | null> {
  const slug = slugify(svc.service_name);
  if (!slug) return null;

  const existing = await ourQueryOne<{ id: string; cost_range_low: number | null; duration_minutes: number | null }>(
    "SELECT id, cost_range_low, duration_minutes FROM services WHERE slug = $1",
    [slug]
  );

  if (existing) {
    // Only update cost/duration if changed
    const costChanged = existing.cost_range_low !== svc.cost;
    const durationChanged = existing.duration_minutes !== svc.duration_in_minutes;
    if (costChanged || durationChanged) {
      await ourQuery(
        `UPDATE services SET cost_range_low = $1, duration_minutes = $2, updated_at = NOW()
         WHERE id = $3`,
        [svc.cost, svc.duration_in_minutes, existing.id]
      );
    }

    // Link to category if not already linked
    if (svc.service_category_id) {
      const catRow = await ourQueryOne<{ id: string }>(
        "SELECT id FROM categories WHERE g99_category_id = $1",
        [svc.service_category_id]
      );
      if (catRow) {
        await ourQuery(
          `INSERT INTO service_categories (service_id, category_id, is_primary)
           VALUES ($1, $2, true) ON CONFLICT DO NOTHING`,
          [existing.id, catRow.id]
        );
      }
    }

    return existing.id;
  }

  // Insert new global service
  const row = await ourQueryOne<{ id: string }>(
    `INSERT INTO services
       (name, slug, cost_range_low, cost_range_high, duration_minutes, g99_service_id, data_source, is_published)
     VALUES ($1, $2, $3, $3, $4, $5, 'g99', false)
     ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug
     RETURNING id`,
    [svc.service_name, slug, svc.cost, svc.duration_in_minutes, svc.service_id]
  );
  const newSvcId = row!.id;

  if (svc.service_category_id) {
    const catRow = await ourQueryOne<{ id: string }>(
      "SELECT id FROM categories WHERE g99_category_id = $1",
      [svc.service_category_id]
    );
    if (catRow) {
      await ourQuery(
        `INSERT INTO service_categories (service_id, category_id, is_primary)
         VALUES ($1, $2, true) ON CONFLICT DO NOTHING`,
        [newSvcId, catRow.id]
      );
    }
  }

  return newSvcId;
}

// ─── Reviews ──────────────────────────────────────────────────────────────────

async function syncReviews(reviews: G99Review[], ourClinicId: string): Promise<void> {
  for (const review of reviews) {
    const source = review.channel === "GOOGLE" ? "google" : "internal";
    await ourQuery(
      `INSERT INTO reviews (clinic_id, rating, body, source, is_approved, g99_review_id)
       VALUES ($1, $2, $3, $4, true, $5)
       ON CONFLICT (g99_review_id) DO UPDATE SET
         rating = EXCLUDED.rating,
         body   = EXCLUDED.body`,
      [ourClinicId, review.ratings, review.message, source, review.id]
    );
  }
}

// ─── Providers ────────────────────────────────────────────────────────────────

async function syncProviders(providers: G99Provider[], ourBizId: string): Promise<void> {
  for (const p of providers) {
    if (p.deleted) {
      // Soft-delete in our DB
      await ourQuery(
        "UPDATE providers SET is_active = false, updated_at = NOW() WHERE g99_user_id = $1",
        [p.id]
      );
      await ourQuery(
        `UPDATE clinic_providers SET is_active = false
         WHERE provider_id = (SELECT id FROM providers WHERE g99_user_id = $1)`,
        [p.id]
      );
      continue;
    }

    const name = `${p.first_name} ${p.last_name}`.trim();
    const existing = await ourQueryOne<OurProvider>(
      "SELECT id, name, title, designation, bio, photo_url FROM providers WHERE g99_user_id = $1",
      [p.id]
    );

    let ourProviderId: string;

    if (existing) {
      ourProviderId = existing.id;
      const changed = fieldsDiff(existing, {
        name,
        title: p.title,
        designation: p.designation,
        bio: p.description,
        photo_url: p.profile_image_url,
      });
      if (Object.keys(changed).length > 0) {
        const { sql, values } = buildUpdate(changed, existing.id);
        await ourQuery(
          `UPDATE providers SET ${sql}, updated_at = NOW() WHERE id = $${values.length + 1}`,
          [...values, existing.id]
        );
      }
    } else {
      const slug = await uniqueSlug(slugify(name), "providers");
      const row = await ourQueryOne<{ id: string }>(
        `INSERT INTO providers
           (business_id, name, slug, title, designation, bio, photo_url, g99_user_id, data_source, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'g99', true)
         RETURNING id`,
        [ourBizId, name, slug, p.title, p.designation, p.description, p.profile_image_url, p.id]
      );
      ourProviderId = row!.id;
    }

    // Provider photo → images table
    if (p.profile_image_url) {
      await upsertImage("provider", ourProviderId, p.profile_image_url, "avatar");
    }

    // Sync clinic assignments
    for (let i = 0; i < p.clinic_ids.length; i++) {
      const ourClinic = await ourQueryOne<{ id: string }>(
        "SELECT id FROM clinics WHERE g99_clinic_id = $1",
        [p.clinic_ids[i]]
      );
      if (!ourClinic) continue;

      await ourQuery(
        `INSERT INTO clinic_providers (clinic_id, provider_id, is_primary, is_active)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (clinic_id, provider_id) DO UPDATE SET
           is_primary = EXCLUDED.is_primary,
           is_active  = EXCLUDED.is_active`,
        [ourClinic.id, ourProviderId, p.is_primary_clinic[i], p.clinic_enabled[i]]
      );
    }
  }
}

// ─── Image upsert ─────────────────────────────────────────────────────────────

async function upsertImage(
  entityType: string,
  entityId: string,
  sourceUrl: string,
  role: string
): Promise<void> {
  await ourQuery(
    `INSERT INTO images (entity_type, entity_id, source_url, role, scrape_status, sort_order)
     VALUES ($1, $2, $3, $4, 'ok', 0)
     ON CONFLICT (entity_type, entity_id, source_url) DO UPDATE SET scrape_status = 'ok'`,
    [entityType, entityId, sourceUrl, role]
  );
}

// ─── Diff helpers ─────────────────────────────────────────────────────────────

/** Returns only the keys whose values differ between current and incoming */
function fieldsDiff(
  current: Record<string, unknown>,
  incoming: Record<string, unknown>
): Record<string, unknown> {
  const diff: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(incoming)) {
    // Treat null and undefined as equivalent for comparison
    const cur = current[key] ?? null;
    const inc = val ?? null;
    if (cur !== inc) diff[key] = inc;
  }
  return diff;
}

/** Build a SET clause from a diff object: returns sql fragment + values array */
function buildUpdate(
  diff: Record<string, unknown>,
  _id: string
): { sql: string; values: unknown[] } {
  const keys = Object.keys(diff);
  const values = keys.map((k) => diff[k]);
  const sql = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
  return { sql, values };
}
