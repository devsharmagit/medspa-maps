/**
 * g99-sync.ts — G99 → MedSpaMaps sync pipeline.
 *
 * Entry point: fetch all valid clinics (website IS NOT NULL) joined with their
 * business in a single query. Group by business. Only businesses that own at
 * least one such clinic are ever touched — no wasted fetches on invalid data.
 *
 * Per valid business:
 *   • Upsert business
 *   • Upsert each valid clinic + hours
 *   • Upsert providers + clinic assignments
 *
 * Not synced from G99 (scraped instead):
 *   • services  → scraped from clinic website
 *   • reviews   → added later
 *   • categories → eliminated
 *
 * Rules:
 *   • Never hard-delete — soft-delete (is_active = false) only
 *   • Only write fields that actually changed (change detection)
 */

import { ourQuery, ourQueryOne, g99Query, g99QueryOne, slugify, uniqueSlug } from "./db-helpers";

// ─── G99 row returned by the main join query ──────────────────────────────────

interface G99JoinRow {
  // Business
  biz_id: bigint;
  biz_name: string;
  biz_logo_url: string | null;
  biz_phone: string | null;
  biz_address: string | null;
  biz_city: string | null;
  biz_state: string | null;
  biz_country: string | null;
  biz_instagram: string | null;
  biz_facebook: string | null;
  biz_about: string | null;
  // Clinic
  clinic_id: bigint;
  clinic_name: string;
  clinic_address: string | null;
  clinic_city: string | null;
  clinic_state: string | null;
  clinic_phone: string | null;
  clinic_email: string | null;
  clinic_website: string;
  clinic_booking_url: string | null;
  clinic_about: string | null;
  clinic_instagram: string | null;
  clinic_facebook: string | null;
  clinic_google_place_id: string | null;
  clinic_google_my_business: string | null;
  clinic_yelp_url: string | null;
}

interface G99Hours {
  day_of_week: string;
  open_hour: string | null;
  close_hour: string | null;
  is_open: boolean;
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
  clinic_ids: bigint[];
  is_primary_clinic: boolean[];
  clinic_enabled: boolean[];
}

// ─── Our DB types ─────────────────────────────────────────────────────────────

interface OurBusiness extends Record<string, unknown> {
  id: string;
  name: string;
  logo_url: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
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
  hours: string | null;
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

  // Single query: all valid clinics + their business, grouped in memory
  const grouped = await fetchValidClinicsGroupedByBusiness();
  const businessIds = [...grouped.keys()];
  const limited = opts.limit ? businessIds.slice(0, opts.limit) : businessIds;

  if (opts.limit && businessIds.length > opts.limit) {
    console.log(`  found ${businessIds.length} valid businesses — processing first ${opts.limit}`);
  } else {
    console.log(`  found ${businessIds.length} valid businesses with website-bearing clinics`);
  }

  let synced = 0;
  let failed = 0;

  for (const bizId of limited) {
    const { business, clinics } = grouped.get(bizId)!;
    try {
      const providers = await fetchProviders(bizId);
      await syncBundle({ business, clinics, providers });
      synced++;
    } catch (err) {
      failed++;
      console.error(`  [ERROR] business g99_id=${bizId} (${business.biz_name}): ${(err as Error).message}`);
    }
  }

  console.log(`── G99 Sync complete — ${synced} ok, ${failed} failed ─────────\n`);
}

// ─── Fetch all valid clinics + businesses in one query ────────────────────────

async function fetchValidClinicsGroupedByBusiness(): Promise<
  Map<bigint, { business: G99JoinRow; clinics: G99JoinRow[] }>
> {
  const rows = await g99Query<G99JoinRow>(
    `SELECT
       b.id              AS biz_id,
       b.name            AS biz_name,
       b.logo_url        AS biz_logo_url,
       b.phone           AS biz_phone,
       b.address         AS biz_address,
       b.city            AS biz_city,
       b.state           AS biz_state,
       b.country         AS biz_country,
       b.instagram       AS biz_instagram,
       b.facebook        AS biz_facebook,
       b.about           AS biz_about,

       c.id              AS clinic_id,
       c.name            AS clinic_name,
       c.address         AS clinic_address,
       c.city            AS clinic_city,
       c.state           AS clinic_state,
       c.contact_number  AS clinic_phone,
       c.notification_email AS clinic_email,
       c.website         AS clinic_website,
       c.appointment_url AS clinic_booking_url,
       c.about           AS clinic_about,
       c.instagram       AS clinic_instagram,
       c.facebook        AS clinic_facebook,
       c.google_place_id AS clinic_google_place_id,
       c.google_my_business AS clinic_google_my_business,
       c.yelp_url        AS clinic_yelp_url

     FROM clinics c
     JOIN businesses b       ON b.id = c.tenant_id
     JOIN business_config bc ON bc.tenant_id = b.id
     WHERE b.deleted = false
       AND bc.is_test_business = false
       AND c.website IS NOT NULL
       AND c.website != ''
     ORDER BY b.id, c.id`
  );

  const map = new Map<bigint, { business: G99JoinRow; clinics: G99JoinRow[] }>();

  for (const row of rows) {
    if (!map.has(row.biz_id)) {
      map.set(row.biz_id, { business: row, clinics: [] });
    }
    map.get(row.biz_id)!.clinics.push(row);
  }

  return map;
}

// ─── Fetch providers for one business ────────────────────────────────────────

async function fetchProviders(g99BizId: bigint): Promise<G99Provider[]> {
  const rawProviders = await g99Query<Omit<G99Provider, "clinic_ids" | "is_primary_clinic" | "clinic_enabled">>(
    `SELECT id, first_name, last_name, title, designation, description, profile_image_url, deleted
     FROM users
     WHERE tenant_id = $1 AND is_provider = true`,
    [g99BizId]
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
  return providers;
}

// ─── Fetch clinic hours ───────────────────────────────────────────────────────

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


// ─── Business upsert ──────────────────────────────────────────────────────────

async function upsertBusiness(g: G99JoinRow): Promise<string> {
  const existing = await ourQueryOne<OurBusiness>(
    `SELECT id, name, logo_url, phone, address, city, state, country,
            instagram_url, facebook_url, about
     FROM businesses WHERE g99_business_id = $1`,
    [g.biz_id]
  );

  if (existing) {
    const changed = fieldsDiff(existing, {
      name:         g.biz_name,
      logo_url:     g.biz_logo_url,
      phone:        g.biz_phone,
      address:      g.biz_address,
      city:         g.biz_city,
      state:        g.biz_state,
      country:      g.biz_country,
      instagram_url: g.biz_instagram,
      facebook_url:  g.biz_facebook,
      about:        g.biz_about,
    });

    if (Object.keys(changed).length > 0) {
      const { sql, values } = buildUpdate(changed);
      await ourQuery(
        `UPDATE businesses SET ${sql}, last_synced_at = NOW(), updated_at = NOW()
         WHERE id = $${values.length + 1}`,
        [...values, existing.id]
      );
    } else {
      await ourQuery("UPDATE businesses SET last_synced_at = NOW() WHERE id = $1", [existing.id]);
    }

    if (g.biz_logo_url) await upsertImage("business", existing.id, g.biz_logo_url, "logo");
    return existing.id;
  }

  const slug = await uniqueSlug(slugify(g.biz_name), "businesses");
  const row = await ourQueryOne<{ id: string }>(
    `INSERT INTO businesses (
       name, slug, logo_url, phone, address, city, state, country,
       instagram_url, facebook_url, about,
       tier, verified, verified_at,
       g99_business_id, g99_tenant_id, data_source, last_synced_at, is_active
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
       'featured', true, NOW(),
       $12, $12, 'g99', NOW(), true
     ) RETURNING id`,
    [
      g.biz_name, slug, g.biz_logo_url, g.biz_phone,
      g.biz_address, g.biz_city, g.biz_state, g.biz_country,
      g.biz_instagram, g.biz_facebook, g.biz_about,
      g.biz_id,
    ]
  );

  const newId = row!.id;
  if (g.biz_logo_url) await upsertImage("business", newId, g.biz_logo_url, "logo");
  return newId;
}

// ─── Clinic upsert ────────────────────────────────────────────────────────────

async function upsertClinic(
  g: G99JoinRow,
  hours: Record<string, unknown>,
  ourBizId: string
): Promise<string> {
  const existing = await ourQueryOne<OurClinic>(
    `SELECT id, name, address, city, state, phone, email, website, booking_url, about,
            instagram_url, facebook_url, google_place_id, google_my_business, yelp_url,
            hours::text AS hours
     FROM clinics WHERE g99_clinic_id = $1`,
    [g.clinic_id]
  );

  const hoursJson = JSON.stringify(hours);

  if (existing) {
    const changed = fieldsDiff(existing, {
      name:               g.clinic_name,
      address:            g.clinic_address,
      city:               g.clinic_city,
      state:              g.clinic_state,
      phone:              g.clinic_phone,
      email:              g.clinic_email,
      website:            g.clinic_website,
      booking_url:        g.clinic_booking_url,
      about:              g.clinic_about,
      instagram_url:      g.clinic_instagram,
      facebook_url:       g.clinic_facebook,
      google_place_id:    g.clinic_google_place_id,
      google_my_business: g.clinic_google_my_business,
      yelp_url:           g.clinic_yelp_url,
    });

    const hoursChanged = existing.hours !== hoursJson;

    if (Object.keys(changed).length > 0 || hoursChanged) {
      const allChanged = hoursChanged ? { ...changed, hours: hoursJson } : changed;
      const { sql, values } = buildUpdate(allChanged);
      await ourQuery(
        `UPDATE clinics SET ${sql}, last_synced_at = NOW(), updated_at = NOW()
         WHERE id = $${values.length + 1}`,
        [...values, existing.id]
      );
    } else {
      await ourQuery("UPDATE clinics SET last_synced_at = NOW() WHERE id = $1", [existing.id]);
    }

    return existing.id;
  }

  const slug = await uniqueSlug(slugify(g.clinic_name), "clinics");
  const row = await ourQueryOne<{ id: string }>(
    `INSERT INTO clinics (
       business_id, name, slug, website, address, city, state, country,
       phone, email, booking_url, about,
       instagram_url, facebook_url, google_place_id, google_my_business, yelp_url,
       hours, tier, verified, featured, g99_clinic_id, data_source,
       last_synced_at, is_active
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, 'US',
       $8, $9, $10, $11,
       $12, $13, $14, $15, $16,
       $17, 'featured', true, true, $18, 'g99',
       NOW(), true
     ) RETURNING id`,
    [
      ourBizId, g.clinic_name, slug, g.clinic_website,
      g.clinic_address, g.clinic_city, g.clinic_state,
      g.clinic_phone, g.clinic_email, g.clinic_booking_url, g.clinic_about,
      g.clinic_instagram, g.clinic_facebook,
      g.clinic_google_place_id, g.clinic_google_my_business, g.clinic_yelp_url,
      hoursJson, g.clinic_id,
    ]
  );
  return row?.id ?? "";
}

// ─── Providers ────────────────────────────────────────────────────────────────

async function syncProviders(providers: G99Provider[], ourBizId: string): Promise<void> {
  for (const p of providers) {
    if (p.deleted) {
      await ourQuery(
        "UPDATE providers SET is_active = false, updated_at = NOW() WHERE g99_user_id = $1",
        [p.id]
      );
      await ourQuery(
        `UPDATE clinic_providers SET is_active = false, updated_at = NOW()
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
        title:       p.title,
        designation: p.designation,
        bio:         p.description,
        photo_url:   p.profile_image_url,
      });
      if (Object.keys(changed).length > 0) {
        const { sql, values } = buildUpdate(changed);
        await ourQuery(
          `UPDATE providers SET ${sql}, last_synced_at = NOW(), updated_at = NOW()
           WHERE id = $${values.length + 1}`,
          [...values, existing.id]
        );
      } else {
        await ourQuery("UPDATE providers SET last_synced_at = NOW() WHERE id = $1", [existing.id]);
      }
    } else {
      const slug = await uniqueSlug(slugify(name), "providers");
      const row = await ourQueryOne<{ id: string }>(
        `INSERT INTO providers
           (business_id, name, slug, title, designation, bio, photo_url,
            g99_user_id, data_source, last_synced_at, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'g99', NOW(), true)
         RETURNING id`,
        [ourBizId, name, slug, p.title, p.designation, p.description, p.profile_image_url, p.id]
      );
      ourProviderId = row!.id;
    }

    if (p.profile_image_url) {
      await upsertImage("provider", ourProviderId, p.profile_image_url, "avatar");
    }

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
           is_active  = EXCLUDED.is_active,
           updated_at = NOW()`,
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

function fieldsDiff(
  current: Record<string, unknown>,
  incoming: Record<string, unknown>
): Record<string, unknown> {
  const diff: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(incoming)) {
    const cur = current[key] ?? null;
    const inc = val ?? null;
    if (cur !== inc) diff[key] = inc;
  }
  return diff;
}

function buildUpdate(diff: Record<string, unknown>): { sql: string; values: unknown[] } {
  const keys = Object.keys(diff);
  const values = keys.map((k) => diff[k]);
  const sql = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
  return { sql, values };
}

// ─── Used by the sync/business API route (single-business sync) ───────────────

export interface G99Bundle {
  business: G99JoinRow;
  clinics: G99JoinRow[];
  providers: G99Provider[];
}

export async function fetchG99BusinessBundle(g99BusinessId: bigint): Promise<G99Bundle> {
  const rows = await g99Query<G99JoinRow>(
    `SELECT
       b.id              AS biz_id,
       b.name            AS biz_name,
       b.logo_url        AS biz_logo_url,
       b.phone           AS biz_phone,
       b.address         AS biz_address,
       b.city            AS biz_city,
       b.state           AS biz_state,
       b.country         AS biz_country,
       b.instagram       AS biz_instagram,
       b.facebook        AS biz_facebook,
       b.about           AS biz_about,

       c.id              AS clinic_id,
       c.name            AS clinic_name,
       c.address         AS clinic_address,
       c.city            AS clinic_city,
       c.state           AS clinic_state,
       c.contact_number  AS clinic_phone,
       c.notification_email AS clinic_email,
       c.website         AS clinic_website,
       c.appointment_url AS clinic_booking_url,
       c.about           AS clinic_about,
       c.instagram       AS clinic_instagram,
       c.facebook        AS clinic_facebook,
       c.google_place_id AS clinic_google_place_id,
       c.google_my_business AS clinic_google_my_business,
       c.yelp_url        AS clinic_yelp_url

     FROM clinics c
     JOIN businesses b ON b.id = c.tenant_id
     WHERE b.id = $1
       AND c.website IS NOT NULL
       AND c.website != ''
     ORDER BY c.id`,
    [g99BusinessId]
  );

  if (rows.length === 0) throw new Error(`G99 business ${g99BusinessId} has no valid clinics`);

  const providers = await fetchProviders(g99BusinessId);
  return { business: rows[0], clinics: rows, providers };
}

export async function syncBundle(bundle: G99Bundle): Promise<void> {
  const { business, clinics, providers } = bundle;
  const ourBizId = await upsertBusiness(business);
  console.log(`  [business] ${business.biz_name} (g99=${business.biz_id} → our=${ourBizId})`);
  for (const clinic of clinics) {
    const hours = await fetchClinicHours(clinic.clinic_id);
    await upsertClinic(clinic, hours, ourBizId);
  }
  await syncProviders(providers, ourBizId);
}
