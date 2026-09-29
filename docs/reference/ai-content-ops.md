# MSM — AI-Leveraged Content & Publishing (discussion doc)

*Purpose: a shared starting point for the meeting. This is direction and options, not a final plan or a commitment to build. No code has changed.*

---

## 1. What the feedback is really asking (plain terms)

As MSM becomes its own business, we want to **grow and maintain the site with one "site manager" + AI**, instead of a full content/SEO/dev team. Two buckets:

- **Content (front end):** AI helps create new pages and content over time — local market pages (e.g. `/locations/texas`, later city pages), how-to guides, and blogs — plus finding topics worth writing and making them SEO-friendly.
- **Dev automation (back end):** routine technical work shouldn't need a developer each time. The headline example: **publishing a blog should not require a developer.**

Goal for the next 3–4 months: finish building. After that: an **AI-centric maintenance mode**.

## 2. The key insight (why this is achievable for us)

Our site was built as **templates + data**, which already separates *content* from *code*:

- A **blog post** = a small structured entry + body text. A new post is fill-in-the-blanks, not engineering.
- **Treatment / condition / location pages** = a template + a data entry. A new page = new data, not new code.

So "**AI writes the content**" is the easy, mostly-solved part. The **one real gap** is the last step: letting a non-developer **publish** without a code deploy.

## 3. Recommendation: build on our own admin, not a new CMS

**Extend the existing admin panel and store posts in our database — do not add Sanity/Contentful.**

- We already have: a database, an authenticated admin area, an established "generate structured data → save via API" pattern (same as "add clinic by pasting JSON"), image tooling, and cron jobs.
- A separate CMS = another vendor, login system, cost, and a migration off our current model — a lot of overhead for a one-manager team.
- The **single change that unlocks "publish without a developer"**: make the **database the source of truth** for posts and let pages refresh on publish (no redeploy). Small, well-understood change.
- *Sanity would only make sense if we had many non-technical editors and content types. For one site manager + AI, our own admin is simpler and cheaper.*

## 4. How the AI blog workflow would feel

**Topic → AI draft → human review → publish.**

1. Person enters a **topic + angle/keyword** (or picks from an AI-suggested topic list).
2. AI writes a **full draft in our fixed blog format** (title, key takeaways, sections, FAQ, call-to-action, image alt text) → saved as a **draft**.
3. Reviewer edits and approves in the admin.
4. **Publish → live**, no deploy.

Two things that make the drafts good:
- **Structured output** — AI must return our exact fields, guided by our house rules (brand name, sentence case, **no pricing**, medical disclaimer) and one or two existing posts as examples.
- **Human review is mandatory** — this is **medical content**; a person must check accuracy and brand voice. AI drafts; a human is the editor.

Realistic throughput: ~10–20 posts/month with one reviewer.

## 5. Do we need "agents" / loops?

- **Start simple:** one good prompt → one structured draft → human review. This is ~90% of the value, cheap and reliable. The only loop is the human editing.
- **Add agentic steps later, where they pay off:** topic/keyword research, outline-first, an automated **self-check** ("has disclaimer? no pricing? links valid? on-brand?"), and scheduled refreshes of stale posts (we already have cron).
- We do **not** need autonomous agents to launch. Assembly line with a human inspector first; more automation later.

## 6. Images (the genuinely hard part)

Text is easy to generate; realistic images are not.

- **AI-generated photoreal images (faces/skin/procedures): avoid.** They often look uncanny or subtly wrong, which hurts a medical **trust** brand.
- **Licensed stock (what we already use, e.g. Adobe Stock): the default.**
- **Recommended hybrid:** AI **suggests and captions**; a human **confirms the licensed pick**. The chosen image then flows into our existing image pipeline (optimize + durable storage). AI *generation* only for non-realistic/illustrative graphics, if at all.

**Summary: text = AI-drafted; images = AI-assisted selection from licensed stock, not AI-generated realism.**

## 7. Must-have guardrails

1. **Human review on every piece** (medical accuracy + brand voice).
2. **Anti-spam / anti-duplication** — many near-identical AI posts can *hurt* SEO; need topic dedup and a quality bar.
3. **Clear ownership** — AI drafts; a named person approves and owns taste.
4. **On-niche topics only** — aesthetics/skin/injectables, not off-brand subjects.

## 8. Suggested phasing

| Phase | What | Effort |
|---|---|---|
| 1 | DB-backed blog + admin "draft → review → publish" flow (no dev to publish) | Highest payoff, moderate |
| 2 | AI drafting into that flow (structured output + house rules) | Moderate |
| 3 | AI-generated local/city market pages (template exists; city pages are unbuilt today) | Natural next extension |
| 4 | Agentic add-ons: topic research, self-QA, scheduled refresh of old posts | Later optimization |

## 9. Open questions for the meeting

- Who is the **reviewer/owner** of published content (esp. medical accuracy)?
- Target **volume** and cadence (posts per month)?
- Which **AI model/vendor** and rough budget?
- **Images**: confirm licensed-stock-first; who approves picks?
- Priority order of extension areas (blogs vs. local/city pages vs. how-to guides)?

---

*One-line summary: Because the site is templates + data, AI can already draft blogs and pages — the real work is a simple, DB-backed "draft → review → publish" flow in our own admin (no new CMS, no developer after setup), with a human editor and licensed-stock images.*

---

## 10. Review notes against the current codebase

These notes clarify what is already true, what still needs to be built, and
where the original wording may be too optimistic. They do not change the main
recommendation.

### What looks right

- Extending the existing admin is a sensible first option. The app already has
  admin authentication, database access, admin APIs, forms, preview/save
  patterns, and clinic/catalog workflows that can be reused conceptually.
- The workflow should be **AI draft → automated checks → human review →
  publish**. AI should not publish medical content without a person approving
  it.
- Treatment and condition pages are well suited to a structured AI workflow
  because they already use shared templates and structured content registries.
- Licensed stock should be the default for realistic medical/medspa imagery.
  AI-generated illustrations can be considered separately, but photorealistic
  faces, skin, and procedures require extra trust and quality scrutiny.
- Topic deduplication and a quality bar are essential. More AI pages do not
  automatically mean more useful content or better SEO.

### What needs to be qualified

#### Publishing without a developer is more than one small change

The current blog is still code-managed:

- Metadata is in `web/src/lib/blog/posts.ts`.
- Article bodies are Markdown files in `web/src/content/blog/`.
- Blog routes are statically generated.
- Blog images are currently local assets under `public/images/blog/`.

To publish from the admin, we still need a content model, draft/published
statuses, editing and preview screens, slug handling, revision history,
publishing permissions, permanent image storage, and a cache/revalidation
mechanism so a new post appears without a code deployment. This is a moderate
feature, not just a single database change, although it is still practical to
build.

#### “Templates + data” is true for some pages, but not all location pages

Treatment and condition pages use reusable templates. State pages also have a
shared template and database-backed clinic data. However, the current
`/locations/[state]/[city]` route is only a placeholder. City pages will need a
real page template and data flow before AI can help populate them.

AI should write the editorial introduction and FAQs, while clinic counts,
provider listings, treatments, and other changing facts should come from the
database. AI should not invent local businesses or live numbers.

#### Existing image tooling is not yet a complete blog image workflow

The repository has useful image validation and durable capture logic for clinic
and provider images. Blog publishing still needs its own workflow for selecting
or uploading an image, storing it permanently, recording its source/license,
and attaching it to a draft. A temporary AI image URL should never be the only
copy used on a published page.

#### The existing cron system is not currently a blog refresh system

Cron infrastructure exists, but the current scheduled work is primarily clinic
refreshes, ratings, and search data. Scheduled blog refreshes would be a new
capability, not something already available out of the box.

#### Clarify the pricing rule

The current blog and landing-page content does discuss general treatment costs.
The safer rule is:

> Do not invent exact clinic prices or present a general estimate as a
> guarantee. General cost context is acceptable when useful, with clear wording
> that prices vary by provider, treatment, and location.

#### Do not commit to a publishing volume yet

“10–20 posts per month” should be treated as a hypothesis, not a target. The
real constraint is review quality and reviewer time, especially for medical
content. A small pilot should measure revision time, factual corrections, and
whether the articles provide distinct value before setting a cadence.

### Recommended interpretation of the plan

The strongest first version is not an autonomous publishing agent. It is a
controlled editorial workflow inside the existing admin:

```text
Manager enters topic and angle
  → AI creates structured draft
  → Automated checks flag missing fields, bad links, duplication, and risky claims
  → Human reviewer edits and approves
  → Publish changes status and refreshes the public page/sitemap
```

Sanity or another CMS can be reconsidered later if the site gains multiple
editors or the custom admin becomes too difficult for editorial work. It does
not need to be the first decision.
