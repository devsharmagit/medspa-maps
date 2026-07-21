# AI Treatment Navigator — Complete Technical Flow

Last updated: July 21, 2026 (optional location, 3-section results, seed + associations + slug reconciliation)

## Overview

The **AI Treatment Navigator** is an anonymous, guided treatment discovery experience available at `/skin-navigator`.

It helps users move from a broad goal like "I want to look younger" or "I do not know what treatment I need" into:

- Possible cosmetic concerns (with where each was deduced from)
- Personalized aesthetic treatment suggestions
- Nearby clinic recommendations from the MedSpaMaps database (when a location is given)

The experience is intentionally light. It avoids long medical intake forms, avoids money or budget questions, and keeps the user focused on one simple decision at a time.

The navigator is informational only. It does not diagnose medical conditions, does not guarantee results, and encourages users to consult qualified providers before choosing a treatment.

## Entry Points

Users can enter the AI Treatment Navigator from:

- Landing page hero CTA: **Find My Treatment**
- Navbar link: **Find My Treatment**
- Direct URL: `/skin-navigator`

## Page Structure

The page uses the existing MedSpaMaps visual system and shared components where possible.

Main page areas:

- Hero/header area
- Step progress indicator
- Current wizard step
- Footer

The wizard uses a smooth animated step transition so the flow feels calm and conversational instead of like a large form.

## Branding

Current user-facing name:

**AI Treatment Navigator**

Supporting page message:

> Find the right aesthetic treatment with a calmer first step.

Supporting description:

> Share a few basics and goals, then get cosmetic treatment ideas and nearby clinics.

## Core UX Principles

- Ask only what is needed.
- Keep each step focused.
- Do not ask budget or money-related questions.
- Do not overwhelm users with medical-style intake.
- Make photo upload optional.
- Make it clear that photo analysis is cosmetic and informational, not diagnostic.
- Let users edit answers, retake the flow, or continue into clinic discovery.
- Preserve progress if the user leaves the page and comes back.

## Wizard Steps

The navigator has five main user-facing steps:

1. Basics
2. Goals
3. Preferences
4. Photo
5. Results

On mobile, the progress labels are shortened to:

- Basic
- Goals
- Pref
- Photo
- Done

## Step 1: Basics

Purpose:

Collect enough context to personalize treatment recommendations and clinic matching without making the user feel like they are completing a medical form.

### User-Facing Fields

#### Age Range

Required.

Visible options:

- Under 25
- 25-34
- 35-44
- 45-54
- 55-64
- 65+

Internal values:

- `under-25`
- `25-34`
- `35-44`
- `45-54`
- `55-64`
- `65-plus`

#### City or ZIP

Optional. Only the age range is required to proceed. When no location is given, the results omit the clinics section entirely (concerns + treatments still render).

Input behavior:

- Uses the existing `LocationTypeahead`.
- Accepts city, city/state, state, or ZIP.
- Example placeholder: `Nashville, TN or 37203`

This field is used later for clinic matching.

Examples of accepted intent:

- `Salt Lake City, UT`
- `UT`
- `Utah`
- `84101`
- `Nashville, TN`

#### Gender

Optional.

This is a free-text field. It is not required for recommendations.

Visible placeholder:

- `Optional`

#### Skin Tone

Optional.

This is a free-text field. It is used only if the user chooses to provide it. The AI must not infer skin tone or protected attributes from images.

Visible placeholder:

- `Optional`

## Step 2: Goals

Purpose:

Let users describe what they want to improve in simple, familiar language. The goal list includes both outcome-based choices and concern-based choices.

The user must select at least one goal.

The user may select up to eight goals.

### Visible Goal Options

Outcome-oriented options:

- Look younger
- Look refreshed
- Glow up for an event
- Natural maintenance

Concern-oriented options:

- Acne
- Wrinkles
- Pigmentation
- Hair loss
- Loose skin
- Dark circles
- Facial volume
- Redness
- Pores
- Texture
- Scars
- Double chin
- Unwanted hair

### Internal Goal Slugs

```ts
[
  "look-younger",
  "look-refreshed",
  "event-ready",
  "natural-maintenance",
  "acne",
  "wrinkles",
  "pigmentation",
  "hair-loss",
  "loose-skin",
  "dark-circles",
  "facial-volume",
  "redness",
  "pores",
  "texture",
  "scars",
  "double-chin",
  "unwanted-hair"
]
```

### Optional Free-Text Goal

Label:

**Anything else optional**

Placeholder:

> Example: I want something subtle with little downtime.

Maximum length:

- 800 characters

This field lets users add context without forcing additional questions.

## Step 3: Preferences

Purpose:

Ask only a few practical questions that help the AI recommend treatments users are more likely to feel comfortable considering.

The current UI intentionally shows only two preference groups.

### Downtime Preference

Visible options:

- None
- A few days
- Flexible

Internal values:

- `none`
- `few-days`
- `flexible`

How it affects recommendations:

- `none` should favor treatments with minimal recovery time.
- `few-days` allows treatments with short visible recovery.
- `flexible` allows a broader recommendation set.

### Comfort Preference

Visible options:

- Gentle
- Injectables or devices okay
- Not sure

Internal values:

- `gentle`
- `injectables-devices-ok`
- `not-sure`

How it affects recommendations:

- `gentle` should favor lower-intensity options such as facials, light lasers, peels, skincare maintenance, or other gentler services.
- `injectables-devices-ok` allows suggestions such as neuromodulators, fillers, RF microneedling, lasers, and energy devices when appropriate.
- `not-sure` keeps the recommendations balanced and explains comfort considerations clearly.

### Hidden Compatibility Defaults

For API compatibility, the request still carries:

- Previous treatments: `not-sure`
- Medical considerations: empty string

These are not shown as active questions in the current UI because the experience should remain short and general.

## Step 4: Optional Photo

Purpose:

Allow the user to provide one face photo to improve cosmetic observations. This step is optional.

The feature currently supports **one image only**.

### Step Copy

Title:

**Add one photo optional**

Description:

> A single clear face photo can help the AI comment on visible cosmetic concerns. It is not stored.

Disclaimer panel:

> Your photo is used only for this analysis request. This is an informational cosmetic assessment, not a diagnosis.

### Photo Options

Users can choose:

- **Use camera**
- **Upload photo**
- **Analyze without a photo**

### Use Camera

The camera option opens a live camera preview using the browser camera API.

Camera behavior:

- Requests front-facing camera when available.
- Shows a live preview.
- Allows the user to cancel.
- Allows the user to capture one photo.
- Converts the captured frame into a JPEG file named `camera-photo.jpg`.

Camera button labels:

- Use camera
- Cancel
- Capture photo

Camera loading message:

- `Starting camera preview...`

Possible camera errors:

- `Camera capture is not available in this browser. You can upload a photo instead.`
- `Camera permission was not available. You can upload a photo instead.`
- `The camera is still starting. Try again in a moment.`
- `Could not capture the photo. Please try upload instead.`
- `Camera preview could not start. Please try upload instead.`
- `Camera preview is taking longer than expected. Check browser camera permission or upload a photo.`

### Upload Photo

Upload requirements:

- JPEG
- PNG
- WebP
- Maximum 5 MB
- One image only

Upload helper text:

> JPEG, PNG, or WebP up to 5 MB

If a user uploads or captures a photo, the UI shows a preview and a remove option.

### Analyze Without A Photo

Users may continue without a photo.

This is important because:

- Some users may not want to share photos.
- Camera permissions may not be available.
- The AI can still use questionnaire answers.

When no photo is provided, the AI response must make clear that photo observations were not included.

## Step 5: Results

Purpose:

Show the user a practical treatment starting point and nearby clinic options.

The results page is intentionally minimal — three card sections so users are not overwhelmed:

1. **Your concerns** (3–5) — each with severity and a source label ("From your answers" / "From your photo" / "From your answers + photo").
2. **Suggested treatments** (3–5) — name + one-line "why it fits" + a "Find clinics" button.
3. **Nearby clinics** (up to 5) — only shown when a location was provided.

Plus:

- A small "Your photo" panel, if a photo was provided in the current session
- Edit and retake controls

> Photo notes, consultation questions, alternative treatments, per-treatment downtime/comfort/cautions/confidence, and the clinic match-score/verified badges were removed from the results UI to keep it scannable. (The AI still returns photoObservations/consultationQuestions in its payload; they are simply not rendered.)

### Results Header

Badge:

**Results ready**

Title:

**Your treatment starting point**

Disclaimer:

> This is informational cosmetic guidance, not medical advice or a diagnosis. Results vary, and a qualified provider should confirm which treatments are appropriate for you.

### User Photo In Results

If the user uploaded or captured a photo during the current session, the results section shows a **Your photo** panel.

The panel includes:

- Image preview
- Reminder that the photo was used only for the current analysis request
- Reminder that MedSpaMaps does not store the photo

The photo preview is not persisted to local storage and is not saved in the database.

If the user leaves and returns, questionnaire progress can be restored, but the photo file itself is not restored.

### Possible Cosmetic Concerns

The AI may return visible or questionnaire-based cosmetic concerns.

Each concern card can show:

- Concern label
- Severity
- Source
- Rationale

Severity values:

- Mild
- Moderate
- Significant
- Unclear

Source values:

- Questionnaire
- Photo
- Both

Empty fallback:

> The AI did not call out a specific visible concern from the information provided.

### Photo Notes

The photo notes section explains whether a photo was included.

Possible status copy:

- `Photos were included in this analysis.`
- `Photos were not included in this analysis.`

The AI may also return:

- Notes
- Limitations

Photo limitations must avoid diagnosis and should explain when lighting, angle, resolution, makeup, facial expression, or lack of multiple views may limit interpretation.

### Recommended Treatments

The AI returns recommended treatments with priority and confidence.

Each treatment card can include:

- Treatment name
- Priority
- Confidence
- Why it fits
- Expected downtime
- Comfort notes
- Cautions
- Search clinics button

Treatment priority values:

- Primary
- Secondary
- Maintenance

Confidence values:

- Low
- Medium
- High

Each recommended treatment has a button:

**Search clinics in {selected location}**

Examples:

- Search clinics in Utah
- Search clinics in Salt Lake City, UT
- Search clinics in 84101

The search button opens the broader clinic search page with the treatment and location prefilled.

When possible, the URL includes:

- Treatment query
- Location label
- Latitude
- Longitude
- Radius
- Sort behavior

### Search All Clinics For This Treatment

The results section also includes a broader treatment search action for the primary recommended treatment:

**Search all clinics for this treatment**

This lets users move from AI recommendations into full directory search even if the nearby matched clinic cards are limited.

### Nearby Clinics

The clinic recommendation section shows nearby clinics from the MedSpaMaps database that match recommended treatments.

Section title:

**Nearby clinics**

Section description:

> Ranked by treatment match, location, ratings, and verified status.

If no clinic matches are found:

> We could not find a nearby clinic match for these services yet. You can still search the full directory by treatment.

### Clinic Card Contents

Each clinic card includes:

- Cover image
- Logo image
- Clinic name
- Rating
- Review count, when available
- Distance, when available
- Match score
- Verified badge, when applicable
- Address
- Matching treatment chips
- View Profile CTA

CTA:

**View Profile**

The profile link points to:

```txt
/clinics/[clinic-slug]
```

### Clinic Card Image Behavior

Cover image:

- Uses the clinic cover image when available.
- Can fall back to a gallery/clinic image.
- Falls back to a branded visual treatment if no image is available.

Logo image:

- Uses the clinic logo when available.
- Falls back to the business logo when available.
- Falls back to clinic initials if no logo is available.

### Consultation Questions

The AI can return practical questions a user may ask during a consultation.

Section title:

**Questions to ask at a consultation**

Examples of appropriate consultation questions:

- Which treatment option best matches my goals and downtime preference?
- How many sessions are usually needed?
- What results are realistic for my skin and goals?
- What side effects or recovery should I expect?
- Are there reasons I should avoid this treatment?

## Result Controls

Users can:

- Edit answers
- Retake
- Search all clinics for a treatment
- Search clinics in their selected location for a treatment
- View a clinic profile

### Edit Answers

Returns the user to the beginning of the wizard with current answers preserved.

### Retake

Clears:

- Wizard answers
- Saved local draft
- Result state
- Selected photo

Then restarts the flow.

## Draft Persistence

The navigator saves non-photo wizard progress in local storage.

Local storage key:

```txt
medspa.ai-treatment-navigator.draft.v1
```

Persisted data includes:

- Current step
- Basics
- Goals
- Preferences
- Result object, when available

Persisted data does not include:

- Uploaded photo bytes
- Captured camera image
- Any reusable photo preview

This means users can visit another page and come back without losing most of their progress, while still preserving photo privacy.

## API Design

## Analyze API

Endpoint:

```http
POST /api/skin-navigator/analyze
```

Content type:

```txt
multipart/form-data
```

Form fields:

- `payload`: JSON string containing questionnaire data
- `photo`: optional image file

Compatibility fallback:

- `frontPhoto` may also be accepted by the backend, but the current UI sends only one `photo`.

### Analyze Request Payload

Conceptual shape:

```ts
{
  basics: {
    ageRange: "under-25" | "25-34" | "35-44" | "45-54" | "55-64" | "65-plus";
    gender?: string;
    location: {
      label: string;
      city?: string;
      state?: string;
      postalCode?: string;
      latitude?: number;
      longitude?: number;
    };
    skinTone?: string;
  };
  goals: {
    selected: string[];
    freeText?: string;
  };
  preferences: {
    previousTreatments: "none" | "yes" | "not-sure";
    downtime: "none" | "few-days" | "flexible";
    comfort: "gentle" | "injectables-devices-ok" | "not-sure";
    medicalConsiderations?: string;
  };
}
```

### Analyze Response

Conceptual success shape:

```ts
{
  success: true;
  data: {
    sessionId: string;
    analysis: NavigatorAIResponse;
    clinics: NavigatorClinicMatch[];
    disclaimer: string;
  }
}
```

### Analyze Error Behavior

The API returns user-facing retryable messages where possible.

Common cases:

- Rate limit exceeded
- Invalid questionnaire payload
- Unsupported image type
- Image too large
- OpenAI API unavailable
- Missing OpenAI configuration
- Unexpected server error

Rate limit message:

> You're trying the navigator quickly. Please wait a bit and try again.

Payload validation message:

> Please check your answers and try again.

OpenAI unavailable message:

> The AI service is temporarily unavailable. Please try again.

Missing configuration message:

> The AI Treatment Navigator is not configured yet.

## Events API

Endpoint:

```http
POST /api/skin-navigator/events
```

Purpose:

Record anonymous funnel and interaction events.

Example event payload:

```ts
{
  sessionId?: string;
  eventName: string;
  step?: string;
  payload?: Record<string, unknown>;
}
```

## Analytics Events

Tracked event names include:

- `navigator.step.basics`
- `navigator.step.goals`
- `navigator.step.preferences`
- `navigator.step.photos`
- `navigator.step.results`
- `navigator.step_completed`
- `navigator.photo_added`
- `navigator.photo_removed`
- `navigator.analysis_requested`
- `navigator.analysis_succeeded`
- `navigator.analysis_failed`
- `navigator.retake`
- `navigator.clinic_profile_clicked`

Analytics should be anonymous and should not store photo bytes.

## AI Response Schema

The AI response must use a strict structured JSON shape. `concerns` and `recommendedTreatments` are each bounded to **3–5** items. `alternatives` was removed.

```ts
{
  concerns: Array<{
    slug: string;
    label: string;
    source: "questionnaire" | "photo" | "both";
    severity: "mild" | "moderate" | "significant" | "unclear";
    rationale: string;
  }>;
  recommendedTreatments: Array<{
    slug: string;
    name: string;
    priority: "primary" | "secondary" | "maintenance";
    confidence: "low" | "medium" | "high";
    whyItFits: string;
    expectedDowntime: string;
    comfortNotes: string;
    cautions: string[];
  }>;
  photoObservations: {
    provided: boolean;
    notes: string[];
    limitations: string[];
  };
  consultationQuestions: string[];
  disclaimer: string;
}
```

## AI Prompt Rules

The AI must:

- Recommend cosmetic treatments only.
- Never diagnose medical conditions.
- Never guarantee outcomes.
- Treat photos as visible cosmetic observations only.
- Encourage consultation with qualified providers.
- Avoid protected-attribute inference from photos.
- Avoid asking or reasoning about budget.
- Prefer canonical service slugs from the MedSpaMaps treatment catalog.
- Give practical cautions without sounding alarming.

The AI should direct users to qualified clinicians for:

- Unusual lesions
- Infection signs
- Severe acne
- Sudden hair loss
- Pregnancy-related concerns
- Medication conflicts
- Anything that appears medical rather than cosmetic

## Accuracy & Determinism

To make results reproducible and better grounded in real, matchable treatments:

- **Seed:** the OpenAI call passes a fixed `seed` (7) alongside `temperature: 0`, so identical answers yield near-identical output.
- **Concern→treatment associations:** the prompt includes, for each of the user's selected concerns, the treatments most commonly offered by clinics that treat that concern. This is derived purely by **co-occurrence** across the two reliable joins — `clinic_concerns` (clinic⇄concern) and `clinic_services` (clinic⇄treatment) — and is **computed once and cached** for the server process (refreshed at most daily), never per request. `clinic_service_concerns` is deliberately **not** used (it is written by ingest but stale/unread). See `web/src/lib/skin-navigator/associations.ts`.
- **No-photo source coercion:** if no photo was included, every returned concern's `source` is forced to `"questionnaire"` after validation.
- **Slug reconciliation:** AI treatment slugs are `pg_trgm`-matched to real catalog services before clinic matching (see Clinic Matching).

## Photo AI Rules

When a photo is included, the AI may comment on visible cosmetic observations such as:

- Acne-like blemishes
- Pigmentation appearance
- Redness appearance
- Fine lines or wrinkles
- Pores
- Texture
- Volume-related cosmetic appearance
- Dark circles appearance

The AI must not:

- Diagnose skin disease
- Identify medical conditions
- Infer race or ethnicity from the image
- Infer sensitive protected attributes from the image
- Claim certainty from a photo
- Store or reuse the image

## Clinic Matching

Clinic matching uses the AI's recommended treatment slugs and the user's selected location.

If no usable location is provided, clinic matching is skipped entirely (returns none) — the UI hides the clinics section rather than showing a location-agnostic list.

The API returns up to 5 clinic matches.

**Slug reconciliation:** before matching, each AI-provided treatment slug that does not exactly match an active `services.slug` is remapped to the closest active service via `pg_trgm` similarity (threshold 0.3). This raises the primary-tier hit rate so real clinics surface instead of falling through to the generic nearby tier.

### Location Resolution

Supported location inputs:

- ZIP code
- City/state
- State name
- State code
- Explicit latitude/longitude from location typeahead

Examples:

- `Utah`
- `UT`
- `Salt Lake City, UT`
- `84101`

If a precise coordinate is available, the matcher can rank by distance.

If only a state is available, the matcher should keep results within that state.

### Treatment Matching

The matcher first tries to match recommended treatment slugs against active canonical services.

If no direct service match is found, it can fall back to clinic concern matching.

Fallback concern matching should use evidence-based concern associations, not arbitrary text matching.

### Ranking Inputs

Clinics are ranked using:

- Treatment availability
- Distance
- Rating or external rating
- Verified status
- Review volume tie-breaker

### Ranking Weights

Treatment recommendation weights:

- Primary: 100
- Secondary: 78
- Maintenance: 58

Score components:

- Treatment score: up to 45 points
- Distance score: up to 25 points
- Rating score: up to 15 points
- Verified status: up to 10 points
- Review volume: up to 5 points

### Distance Behavior

When coordinates are available:

- Distance is calculated in miles.
- Matches are limited to a practical nearby radius.
- Closer clinics rank higher, assuming treatment relevance is comparable.

When only state is available:

- Clinics should be restricted to that state.
- State filtering may use both clinic and clinic location state data.

## Database Tables

## `ai_navigator_sessions`

Purpose:

Store anonymous analysis sessions and model metadata without storing photo bytes.

Fields:

```sql
id uuid primary key default gen_random_uuid()
anonymous_id text
ip_hash text
user_agent text
request jsonb not null
photo_count integer default 0
vision_included boolean default false
ai_response jsonb
matched_clinic_ids uuid[] default '{}'
model text
input_tokens integer
output_tokens integer
latency_ms integer
error_code text
created_at timestamptz default now()
expires_at timestamptz default now() + interval '90 days'
```

Retention assumption:

- 90 days

Photo storage:

- No photo bytes are stored.

## `ai_navigator_events`

Purpose:

Store anonymous funnel and interaction events.

Fields:

```sql
id uuid primary key default gen_random_uuid()
session_id uuid references ai_navigator_sessions(id) on delete set null
event_name text not null
step text
payload jsonb default '{}'
created_at timestamptz default now()
```

## Privacy

The navigator is anonymous by default.

It stores:

- Questionnaire answers
- AI response JSON
- Matched clinic IDs
- Photo count
- Whether vision was used
- Model metadata
- Latency
- Token usage
- Anonymous analytics events

It does not store:

- Uploaded photo bytes
- Captured camera image bytes
- Persistent face image previews

Photos are sent transiently to the AI service only for the current request.

## Safety And Legal Copy

Core disclaimer:

> This is informational cosmetic guidance, not medical advice or a diagnosis. Results vary, and a qualified provider should confirm which treatments are appropriate for you.

Upload disclaimer:

> Your photo is used only for this analysis request. This is an informational cosmetic assessment, not a diagnosis.

Recommended safety behavior:

- Do not diagnose.
- Do not guarantee results.
- Do not claim before/after certainty.
- Do not say a treatment is medically necessary.
- Encourage consultation with qualified providers.
- Mention that results and suitability vary.
- Treat urgent, unusual, or medical concerns as provider-consultation topics.

## Mobile Behavior

The feature is designed to work on mobile screens.

Mobile design expectations:

- Progress labels shorten cleanly.
- Inputs remain full width.
- Goal chips wrap without horizontal scrolling.
- Result sections stack vertically.
- Clinic cards stack one per row.
- Cover images and logo overlays remain visible.
- Buttons remain large enough to tap.
- No horizontal overflow.
- Camera capture works through browser permissions when available.

## Important User-Facing Options Summary

### Basics

Age range:

- Under 25
- 25-34
- 35-44
- 45-54
- 55-64
- 65+

Location:

- City
- City/state
- ZIP
- State name/code

Optional:

- Gender
- Skin tone

### Goals

- Look younger
- Look refreshed
- Glow up for an event
- Natural maintenance
- Acne
- Wrinkles
- Pigmentation
- Hair loss
- Loose skin
- Dark circles
- Facial volume
- Redness
- Pores
- Texture
- Scars
- Double chin
- Unwanted hair
- Anything else optional

### Preferences

Downtime:

- None
- A few days
- Flexible

Comfort:

- Gentle
- Injectables or devices okay
- Not sure

### Photo

- Use camera
- Upload photo
- Analyze without a photo
- Remove photo
- Capture photo
- Cancel

### Results

- Edit answers
- Retake
- Search all clinics for this treatment
- Search clinics in selected location
- View Profile

## Complete Technical Flow

This section documents the end-to-end data flow from user input to AI analysis to clinic recommendations.

### 1. Data Collection Phase (Frontend)

**Location:** `web/src/app/skin-navigator/skin-navigator-client.tsx`

The wizard collects data across 4 steps:

#### Step 1: Basics
```typescript
{
  ageRange: "under-25" | "25-34" | "35-44" | "45-54" | "55-64" | "65-plus",
  gender: string, // optional, free-text
  skinTone: string, // optional, free-text
  location: {
    label: string,        // display label like "Nashville, TN"
    value: string,        // search value
    lat: number | null,   // coordinates when available
    lng: number | null
  }
}
```

#### Step 2: Goals & Concerns
```typescript
{
  selected: string[], // 1-8 slugs from predefined options
  freeText: string    // optional, up to 800 chars
}
```

Available goal/concern slugs:
- Goals: `look-younger`, `look-refreshed`, `event-ready`, `natural-maintenance`
- Concerns: `acne`, `wrinkles`, `pigmentation`, `hair-loss`, `loose-skin`, `dark-circles`, `facial-volume`, `redness`, `pores`, `texture`, `scars`, `double-chin`, `unwanted-hair`

#### Step 3: Preferences
```typescript
{
  previousTreatments: "none" | "yes" | "not-sure", // hidden, defaults to "not-sure"
  downtime: "none" | "few-days" | "flexible",
  comfort: "gentle" | "injectables-devices" | "not-sure",
  medicalConsiderations: string // hidden, defaults to ""
}
```

#### Step 4: Photo (Optional)
User can:
- Upload a photo (JPEG/PNG/WebP, max 5MB)
- Capture from camera
- Skip photo entirely

Photo is stored as `File` object in component state, NOT in localStorage.

### 2. Request Submission

**Endpoint:** `POST /api/skin-navigator/analyze`  
**Content-Type:** `multipart/form-data`

#### Form Data Structure
```typescript
FormData {
  payload: string, // JSON.stringify(questionnaireData)
  photo?: File     // optional image file
}
```

The `payload` field contains:
```typescript
{
  basics: {
    ageRange: string,
    gender: string,
    skinTone: string,
    location: {
      value: string,
      label: string,
      lat: number | null,
      lng: number | null
    }
  },
  goals: {
    selected: string[],
    freeText: string
  },
  preferences: {
    previousTreatments: "not-sure",
    downtime: string,
    comfort: string,
    medicalConsiderations: ""
  }
}
```

### 3. API Processing

**Location:** `web/src/app/api/skin-navigator/analyze/route.ts`

#### Rate Limiting
- Key: `skin-navigator:{ip}`
- Limit: 15 requests/hour in production, 1000 in development
- Returns 429 with retry-after message if exceeded

#### Photo Processing
1. Validates file type (JPEG, PNG, WebP only)
2. Validates file size (max 5MB)
3. Converts to base64:
```typescript
{
  label: "Face photo",
  mediaType: string, // e.g., "image/jpeg"
  base64: string     // base64-encoded image data
}
```

#### Validation
Uses Zod schema validation on the request payload:
- Age range must be valid enum
- Location value must be 2-120 chars
- Goals: 1-8 selections required
- Free text fields capped at 800 chars

### 4. Treatment Catalog Loading

**Location:** `web/src/lib/skin-navigator/ai.ts` → `loadPromptCatalog()`

Queries the database for active treatments and concerns, ordered by popularity:

```sql
-- Services (treatments)
SELECT s.slug, s.name
FROM services s
WHERE s.is_active = true
  AND s.name !~* '(dentistry|dental|orthodont|veneer)'
ORDER BY (
  SELECT count(*) 
  FROM clinic_services cs
  WHERE cs.service_id = s.id 
    AND cs.is_active = true
) DESC, s.name
LIMIT 120

-- Concerns
SELECT co.slug, co.name
FROM concerns co
WHERE co.is_active = true
ORDER BY (
  SELECT count(*) 
  FROM clinic_concerns cc
  WHERE cc.concern_id = co.id 
    AND cc.is_active = true
) DESC, co.name
LIMIT 120
```

**Why ordered by popularity?** So the AI prefers canonical, widely-offered treatments (like "botox", "dermal-fillers") that can actually match real clinics, rather than niche brand-specific slugs.

Result structure:
```typescript
{
  treatments: Array<{
    slug: string,
    name: string,
    summary: null,
    aliases: []
  }>,
  concerns: Array<{
    slug: string,
    name: string,
    summary: null,
    aliases: []
  }>
}
```

### 5. Prompt Construction

**Location:** `web/src/lib/skin-navigator/prompt.ts`

#### System Prompt
```typescript
buildNavigatorSystemPrompt(): string
```

Contains:
- Role definition: "MedSpaMaps AI Treatment Navigator"
- Purpose: informational cosmetic treatment education
- Safety rules:
  - Never diagnose medical conditions
  - Never identify disease or guarantee results
  - Photos are cosmetic observations only (texture, redness, pigment, blemishes, pores, lines, volume)
  - Do not infer protected attributes (ethnicity, age, health status)
  - Medical concerns (lesions, infection, severe symptoms) → refer to clinician
  - No budget questions
  - Prefer canonical treatment/concern slugs from catalog
- Disclaimer requirement

#### User Prompt
```typescript
buildNavigatorUserPrompt(request, catalog, hasPhotos): string
```

Returns a JSON string containing:
```json
{
  "task": "Create a structured cosmetic treatment navigation result...",
  "userInput": {
    "basics": { ... },
    "goals": { ... },
    "preferences": { ... },
    "goalLabels": ["Look younger", "Wrinkles", ...],
    "goals": ["Look younger", "Look refreshed"],
    "concernsToFix": ["Wrinkles", "Pigmentation"],
    "photosProvided": true
  },
  "catalog": {
    "treatments": [...],
    "concerns": [...]
  },
  "rules": [
    "Recommend 2 to 4 primary/secondary treatments when appropriate.",
    "Use low confidence when inputs are sparse or photo quality limits observation.",
    "Use gentle/low-downtime options when user prefers gentle care.",
    "If photos not provided, keep photoObservations.provided false.",
    "Do not diagnose; phrase as cosmetic concerns or visible signs."
  ]
}
```

The prompt splits goals into two categories for clarity:
- **Aspirational goals:** "look younger", "look refreshed", etc.
- **Specific concerns to fix:** "wrinkles", "acne", "pigmentation", etc.

### 6. Tool Schema (Structured Output)

**Location:** `web/src/lib/skin-navigator/prompt.ts` → `NAVIGATOR_TOOL_SCHEMA`

The LLM is forced to use structured output via OpenAI's function calling with `strict: true`:

```typescript
{
  type: "object",
  additionalProperties: false,
  required: [
    "concerns",
    "recommendedTreatments", 
    "alternatives",
    "photoObservations",
    "consultationQuestions",
    "disclaimer"
  ],
  properties: {
    concerns: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        required: ["slug", "label", "source", "severity", "rationale"],
        properties: {
          slug: { type: "string" },
          label: { type: "string" },
          source: { enum: ["questionnaire", "photo", "both"] },
          severity: { enum: ["mild", "moderate", "significant", "unclear"] },
          rationale: { type: "string" }
        }
      }
    },
    recommendedTreatments: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        required: [
          "slug", "name", "priority", "confidence",
          "whyItFits", "expectedDowntime", "comfortNotes", "cautions"
        ],
        properties: {
          slug: { type: "string" },
          name: { type: "string" },
          priority: { enum: ["primary", "secondary", "maintenance"] },
          confidence: { enum: ["low", "medium", "high"] },
          whyItFits: { type: "string" },
          expectedDowntime: { type: "string" },
          comfortNotes: { type: "string" },
          cautions: {
            type: "array",
            maxItems: 5,
            items: { type: "string" }
          }
        }
      }
    },
    alternatives: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        required: ["slug", "name", "rationale"],
        properties: {
          slug: { type: "string" },
          name: { type: "string" },
          rationale: { type: "string" }
        }
      }
    },
    photoObservations: {
      type: "object",
      required: ["provided", "notes", "limitations"],
      properties: {
        provided: { type: "boolean" },
        notes: {
          type: "array",
          maxItems: 6,
          items: { type: "string" }
        },
        limitations: {
          type: "array",
          maxItems: 4,
          items: { type: "string" }
        }
      }
    },
    consultationQuestions: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: { type: "string" }
    },
    disclaimer: { type: "string" }
  }
}
```

### 7. OpenAI API Call

**Location:** `web/src/lib/ai/openai.ts` → `extractViaOpenAI()`

#### API Configuration
```typescript
{
  model: "gpt-4o-mini", // from OPENAI_MODEL env var
  temperature: 0,
  max_completion_tokens: 2400,
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPromptOrContentArray }
  ],
  tools: [{
    type: "function",
    function: {
      name: "create_treatment_navigation",
      description: "Create non-diagnostic cosmetic treatment recommendations...",
      strict: true,
      parameters: NAVIGATOR_TOOL_SCHEMA
    }
  }],
  tool_choice: {
    type: "function",
    function: { name: "create_treatment_navigation" }
  }
}
```

#### Image Handling
When photos are provided, the user message becomes a content array:

```typescript
[
  { type: "text", text: userPromptJSON },
  { type: "text", text: "Face photo" },
  { 
    type: "image_url", 
    image_url: { 
      url: "data:image/jpeg;base64,{base64EncodedData}" 
    } 
  }
]
```

#### Retry Logic
- Max 5 retries for 429 (rate limit) and 5xx errors
- Respects `Retry-After` header
- Exponential backoff: min(2^attempt * 1000, 30000)ms
- 120-second request timeout

#### Response Parsing
1. Checks for `refusal` → throws error if present
2. Finds tool call matching `create_treatment_navigation`
3. Extracts `function.arguments` (JSON string)
4. Parses JSON
5. Validates against Zod schema `NavigatorAnalysisSchema`

Returns:
```typescript
{
  analysis: NavigatorAnalysis, // validated structured data
  model: string,               // actual model used
  usage: {
    input_tokens: number,
    output_tokens: number
  }
}
```

### 8. Response Validation

**Location:** `web/src/lib/skin-navigator/schema.ts` → `NavigatorAnalysisSchema`

Zod validates the LLM's JSON output:

```typescript
{
  concerns: Array<{
    slug: string, // 1-120 chars
    label: string, // 1-120 chars
    source: "questionnaire" | "photo" | "both",
    severity: "mild" | "moderate" | "significant" | "unclear",
    rationale: string // 1-700 chars
  }>, // max 6

  recommendedTreatments: Array<{
    slug: string, // 1-120 chars
    name: string, // 1-120 chars
    priority: "primary" | "secondary" | "maintenance",
    confidence: "low" | "medium" | "high",
    whyItFits: string, // 1-900 chars
    expectedDowntime: string, // 1-160 chars
    comfortNotes: string, // 1-300 chars
    cautions: string[] // max 5 items, each 1-220 chars
  }>, // 1-5 required

  alternatives: Array<{
    slug: string, // 1-120 chars
    name: string, // 1-120 chars
    rationale: string // 1-500 chars
  }>, // max 4

  photoObservations: {
    provided: boolean,
    notes: string[], // max 6 items, each 1-260 chars
    limitations: string[] // max 4 items, each 1-260 chars
  },

  consultationQuestions: string[], // 1-5 required, each 1-220 chars
  disclaimer: string // 1-700 chars
}
```

### 9. Clinic Matching

**Location:** `web/src/lib/skin-navigator/clinic-match.ts`

The clinic matcher uses a three-tier fallback strategy:

#### Tier 1: Match by Treatment Slugs (Primary Strategy)

1. Extract treatment slugs from AI response with priority weights:
   - Primary: 100 points
   - Secondary: 78 points
   - Maintenance: 58 points
   - Alternative: 40 points

2. Validate slugs against active services in database

3. Query clinics offering those services:

```sql
SELECT c.*, 
  MAX(requested.weight) AS best_service_weight,
  distance_calculation AS distance_miles,
  matched_service_names
FROM clinics c
JOIN clinic_services cs ON cs.clinic_id = c.id
JOIN services s ON s.id = cs.service_id
  AND s.slug = ANY($slugs)
WHERE location_filter
GROUP BY c.id
LIMIT 80
```

4. Score each clinic:
   - Treatment match: up to 45 points (based on best service weight)
   - Distance: up to 25 points (if coordinates available)
   - Rating: up to 15 points
   - Review count: up to 5 points
   - Total: 0-90 points

5. Return top 5 by score

#### Tier 2: Match by Concerns (Fallback)

If no treatment matches found:

1. Extract concern slugs from AI response
2. Query clinics that have those concerns:

```sql
SELECT c.*, 55 AS best_service_weight, ...
FROM clinics c
WHERE EXISTS (
  SELECT 1 FROM clinic_concerns cc
  JOIN concerns con ON con.id = cc.concern_id
  WHERE cc.clinic_id = c.id
    AND con.slug = ANY($concernSlugs)
    AND cc.source IN ('scraped', 'manual')
)
AND NOT EXISTS (
  SELECT 1 FROM clinic_concerns cc2
  WHERE cc2.clinic_id = c.id
    AND cc2.source = 'removed'
)
```

3. Populate `matchedTreatments` with any services clinic offers (up to 5)
4. Score and return top 5

#### Tier 3: Nearby Clinics (Last Resort)

If no concern matches found:

1. Find ANY active clinics near the user's location
2. Use preferred treatment weights to populate `matchedTreatments` (overlap only)
3. Sort by:
   - Distance (if coordinates available)
   - Rating
   - Review count
4. Return top 5

**Why three tiers?** The AI often recommends specific brand/technique slugs that few clinics list verbatim. The fallback ensures users always see relevant local clinics.

#### Location Resolution

Supports multiple formats:

```typescript
// Explicit coordinates (from typeahead)
{ lat: 36.1627, lng: -86.7816, label: "Nashville, TN" }

// ZIP code → lookup coordinates
"37203" → { lat: 36.1627, lng: -86.7816, state_code: "TN" }

// City, State → lookup coordinates
"Nashville, TN" → { lat: 36.1627, lng: -86.7816, state_code: "TN" }

// State code/name → filter by state only
"Utah" or "UT" → { state_code: "UT", state_name: "Utah" }

// Free text → fuzzy search
"Nashville area" → search city/state/zip fields
```

Distance calculation (when coordinates available):
```sql
3959 * acos(
  GREATEST(-1, LEAST(1,
    cos(radians(userLat)) * cos(radians(clinicLat))
    * cos(radians(clinicLng) - radians(userLng))
    + sin(radians(userLat)) * sin(radians(clinicLat))
  ))
)
```
Returns distance in miles, filtered to 80-mile radius.

### 10. Session Persistence

**Location:** `web/src/lib/skin-navigator/sessions.ts`

Saves to `ai_navigator_sessions` table:

```sql
INSERT INTO ai_navigator_sessions (
  anonymous_id,
  ip_hash,
  user_agent,
  request,           -- questionnaire JSON
  photo_count,       -- 0 or 1
  vision_included,   -- boolean
  ai_response,       -- full NavigatorAnalysis JSON
  matched_clinic_ids,-- UUID array
  model,             -- e.g., "gpt-4o-mini"
  input_tokens,
  output_tokens,
  latency_ms,
  created_at,
  expires_at         -- 90 days retention
)
```

**What is NOT stored:**
- Photo bytes (photos sent to OpenAI but not persisted)
- User identity (session is anonymous)

Returns session UUID for event tracking.

### 11. Response Assembly

**API Response:**
```typescript
{
  success: true,
  data: {
    sessionId: string | null,
    analysis: NavigatorAnalysis,
    clinics: NavigatorClinicMatch[],
    disclaimer: string
  }
}
```

**Clinic Match Structure:**
```typescript
{
  clinicId: string,
  name: string,
  slug: string,
  profileUrl: "/clinics/{slug}",
  distanceMiles: number | null,
  address: string | null,
  city: string | null,
  state: string | null,
  zip: string | null,
  rating: number | null,        // 0-5, rounded to 1 decimal
  reviewCount: number,
  verified: boolean,
  coverImageUrl: string | null,
  logoUrl: string | null,
  matchedTreatments: Array<{
    name: string,
    slug: string
  }>,
  matchScore: number            // 0-90
}
```

### 12. Frontend Display

**Location:** `web/src/app/skin-navigator/skin-navigator-client.tsx`

Results are displayed in sections:

1. **User Photo Preview** (if uploaded in current session)
2. **Possible Cosmetic Concerns**
   - Cards showing label, severity, source, rationale
3. **Photo Notes**
   - Whether photo was included
   - Notes and limitations from AI
4. **Recommended Treatments**
   - Cards showing name, priority, confidence
   - Why it fits, downtime, comfort notes, cautions
   - "Search clinics" button per treatment
5. **Nearby Clinics**
   - Cards with cover image, logo, name, rating, distance
   - Match score, verified badge
   - Matched treatment chips
   - "View Profile" link
6. **Consultation Questions**
   - List of practical questions to ask providers

### 13. Draft Persistence (Local Storage)

**Key:** `medspa.ai-treatment-navigator.draft.v1`

Stored locally:
```typescript
{
  state: WizardState,      // basics, goals, preferences
  stepIndex: number,
  result: NavigatorAnalyzeResponse | null
}
```

**NOT stored:**
- Photo File object
- Photo base64 data

**Why?** Preserves user progress if they leave the page, while respecting photo privacy.

### 14. Analytics Events

**Endpoint:** `POST /api/skin-navigator/events`

Tracked events:
- `navigator.step.{stepName}` — user views step
- `navigator.step_completed` — user completes step
- `navigator.photo_added` / `navigator.photo_removed`
- `navigator.analysis_requested`
- `navigator.analysis_succeeded` / `navigator.analysis_failed`
- `navigator.retake` — user resets flow
- `navigator.clinic_profile_clicked`

Event payload:
```typescript
{
  sessionId: string | null,
  eventName: string,
  step: string | undefined,
  payload: Record<string, unknown>
}
```

Stored in `ai_navigator_events` table for funnel analysis.

## Data Flow Summary

```
User Input (4 steps)
  ↓
Form Submission (multipart/form-data)
  ↓
API Validation (Zod schemas, rate limiting)
  ↓
Photo Processing (base64 conversion)
  ↓
Catalog Loading (DB query for treatments/concerns)
  ↓
Prompt Construction (system + user prompts)
  ↓
OpenAI API Call (gpt-4o-mini, structured output)
  ↓
Response Validation (Zod schema)
  ↓
Clinic Matching (3-tier: treatments → concerns → nearby)
  ↓
Session Persistence (DB, 90-day retention)
  ↓
Response Assembly (analysis + clinics + disclaimer)
  ↓
Frontend Display (results step)
```

## Error Handling

### Client-Side Errors
- Photo too large (>5MB) → inline error
- Photo wrong type → inline error
- Missing required fields → continue button disabled + hint text
- Camera permission denied → fallback to upload
- Rate limit exceeded → retry-after message

### Server-Side Errors
- Invalid payload → 400 with user-friendly message
- Photo validation fails → 400/413 with specific message
- Missing OPENAI_API_KEY → 503 "not configured yet"
- OpenAI API error → 502 "temporarily unavailable"
- Zod validation fails → 422 "check your answers"

All errors are logged but sanitized for user display.

## Implementation File Map

Main page:

- `web/src/app/skin-navigator/page.tsx`
- `web/src/app/skin-navigator/skin-navigator-client.tsx`

API routes:

- `web/src/app/api/skin-navigator/analyze/route.ts`
- `web/src/app/api/skin-navigator/events/route.ts`

Navigator library:

- `web/src/lib/skin-navigator/schema.ts` — Zod schemas and validation
- `web/src/lib/skin-navigator/prompt.ts` — System/user prompt construction
- `web/src/lib/skin-navigator/ai.ts` — OpenAI integration, catalog loading, seed, post-processing
- `web/src/lib/skin-navigator/associations.ts` — cached concern→treatment co-occurrence map
- `web/src/lib/skin-navigator/clinic-match.ts` — 3-tier clinic matching + slug reconciliation
- `web/src/lib/skin-navigator/sessions.ts` — Database session persistence
- `web/src/lib/skin-navigator/analytics.ts` — Event tracking

AI provider:

- `web/src/lib/ai/openai.ts` — OpenAI Chat Completions with structured output

Database:

- `web/scripts/add-ai-navigator-tables.sql`
- `web/db/schema.sql`
- `web/scripts/schema.sql`

Landing and navigation links:

- `web/src/components/hero/hero-header.tsx`
- `web/src/components/hero/hero-section.tsx`

Global animation styles:

- `web/src/app/globals.css`

