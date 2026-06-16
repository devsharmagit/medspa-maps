import type { CheerioAPI } from "cheerio";
import type { ScrapedProvider } from "./types";
import { cleanText, toAbsolute, dedupeBy } from "./utils";

const TEAM_CONTAINER_SELECTORS = [
  "[class*='team-member']",
  "[class*='team-card']",
  "[class*='staff-member']",
  "[class*='provider-card']",
  "[class*='doctor-card']",
  "[class*='practitioner']",
  "[class*='team-item']",
  "[class*='staff-item']",
  "[class*='person-card']",
  "[class*='bio-card']",
  ".team-member",
  ".staff-member",
  ".provider",
  ".doctor",
];

const MEDICAL_TITLES = [
  "MD", "DO", "NP", "NP-C", "PA", "PA-C", "RN", "BSN", "MSN",
  "APRN", "FNP", "DNP", "LE", "LAC", "CRNA", "Injector",
  "Nurse", "Doctor", "Medical Director", "Aesthetician", "Esthetician",
];

const MEDSPA_SPECIALIZATIONS = [
  "Botox", "Dysport", "Fillers", "Juvederm", "Restylane", "Sculptra",
  "Laser", "CoolSculpting", "Hydrafacial", "Chemical Peel", "Microneedling",
  "PRP", "PDO Threads", "Kybella", "Morpheus8", "RF", "IPL",
];

/** Extract team/provider cards from a page */
export function extractProviders($: CheerioAPI, baseUrl: string): ScrapedProvider[] {
  const providers: ScrapedProvider[] = [];

  // Strategy 1: Find team member containers
  for (const containerSel of TEAM_CONTAINER_SELECTORS) {
    const containers = $(containerSel);
    if (containers.length === 0) continue;

    containers.each((_, container) => {
      const provider = extractProviderFromContainer($, container, baseUrl);
      if (provider) providers.push(provider);
    });

    if (providers.length > 0) break;
  }

  // Strategy 2: Schema.org Person markup
  if (providers.length === 0) {
    $("[itemtype*='Person'],[itemscope][itemtype*='schema.org/Person']").each((_, el) => {
      const name = cleanText($("[itemprop='name']", el).first().text());
      if (!name) return;
      const jobTitle = cleanText($("[itemprop='jobTitle']", el).first().text());
      const desc = cleanText($("[itemprop='description']", el).first().text());
      const img = $("[itemprop='image']", el).first().attr("src");

      providers.push({
        name,
        title: extractTitle(name, jobTitle) ?? undefined,
        designation: jobTitle || undefined,
        bio: desc || undefined,
        photo_url: img ? toAbsolute(img, baseUrl) ?? undefined : undefined,
      });
    });
  }

  return dedupeBy(
    providers.filter((p) => p.name.length > 2 && p.name.length < 80),
    (p) => p.name.toLowerCase()
  );
}

function extractProviderFromContainer(
  $: CheerioAPI,
  container: Parameters<typeof $>[0],
  baseUrl: string
): ScrapedProvider | null {
  // Name: first heading or strong tag
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nameEl = $(container as any)
    .find("h1,h2,h3,h4,h5,[class*='name'],[class*='title']")
    .first();
  const rawName = cleanText(nameEl.text());
  if (!rawName || rawName.length < 3) return null;

  // Strip trailing credentials from name (e.g. "Jane Doe, MD, NP-C")
  const { cleanName, credentials } = splitNameAndCredentials(rawName);
  if (!cleanName) return null;

  // Title (job title / role)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const titleEl = $(container as any)
    .find("[class*='title'],[class*='role'],[class*='position'],[class*='designation'],[class*='subtitle']")
    .not(nameEl)
    .first();
  const rawTitle = cleanText(titleEl.text());

  // Bio
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bioEl = $(container as any).find("p,[class*='bio'],[class*='desc'],[class*='text']").first();
  const bio = cleanText(bioEl.text());

  // Photo
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const imgEl = $(container as any).find("img").first();
  const imgSrc = imgEl.attr("src") ?? imgEl.attr("data-src") ?? imgEl.attr("data-lazy-src");
  const photoUrl = imgSrc ? toAbsolute(imgSrc, baseUrl) : null;

  // Specializations — look for medspa keywords in bio
  const bioLower = bio.toLowerCase();
  const specializations = MEDSPA_SPECIALIZATIONS.filter((s) =>
    bioLower.includes(s.toLowerCase())
  );

  return {
    name: cleanName,
    title: extractTitle(cleanName, rawTitle || credentials) ?? undefined,
    designation: rawTitle && rawTitle !== cleanName ? rawTitle : undefined,
    bio: bio.length > 20 && bio !== cleanName ? bio : undefined,
    photo_url: photoUrl && !photoUrl.includes("placeholder") && !photoUrl.includes("blank")
      ? photoUrl
      : undefined,
    specializations: specializations.length > 0 ? specializations : undefined,
  };
}

/**
 * Separates "Jane Doe, MD, NP-C" → { cleanName: "Jane Doe", credentials: "MD, NP-C" }
 */
function splitNameAndCredentials(raw: string): { cleanName: string; credentials: string } {
  const credPattern = new RegExp(
    `[,\\s]+(${MEDICAL_TITLES.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(.*)?$`,
    "i"
  );
  const match = raw.match(credPattern);
  if (match) {
    return {
      cleanName: raw.slice(0, match.index).trim(),
      credentials: match[0].replace(/^[,\s]+/, "").trim(),
    };
  }
  return { cleanName: raw, credentials: "" };
}

/** Determine the primary title from job title or credentials */
function extractTitle(name: string, titleOrCreds: string): string | null {
  if (!titleOrCreds) return null;

  // If it looks like a real job title (not just credentials), return as-is
  if (titleOrCreds.length > 3 && !/^[A-Z\-,\s]+$/.test(titleOrCreds)) {
    return titleOrCreds;
  }

  // Otherwise it's credentials — format them
  const matched = MEDICAL_TITLES.filter((t) =>
    titleOrCreds.toUpperCase().includes(t.toUpperCase())
  );
  return matched.length > 0 ? matched.join(", ") : titleOrCreds || null;
}
