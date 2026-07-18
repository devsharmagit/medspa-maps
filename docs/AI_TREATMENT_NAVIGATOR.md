# AI Treatment Navigator

Last updated: July 16, 2026

## Overview

The **AI Treatment Navigator** is an anonymous, guided treatment discovery experience available at `/skin-navigator`.

It helps users move from a broad goal like "I want to look younger" or "I do not know what treatment I need" into:

- Possible cosmetic concerns
- Personalized aesthetic treatment suggestions
- Treatment alternatives
- Consultation guidance
- Nearby clinic recommendations from the MedSpaMaps database

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

Required.

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

The results page includes:

- Uploaded/captured user photo preview, if one was provided in the current session
- Possible cosmetic concerns
- Photo notes
- Recommended treatments
- Clinic recommendations
- Consultation questions
- Edit and retake controls

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

The AI response must use a strict structured JSON shape.

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
  alternatives: Array<{
    slug: string;
    name: string;
    rationale: string;
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

The API returns up to 12 clinic matches.

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
- Alternative: 40

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

## Implementation File Map

Main page:

- `web/src/app/skin-navigator/page.tsx`
- `web/src/app/skin-navigator/skin-navigator-client.tsx`

API routes:

- `web/src/app/api/skin-navigator/analyze/route.ts`
- `web/src/app/api/skin-navigator/events/route.ts`

Navigator library:

- `web/src/lib/skin-navigator/schema.ts`
- `web/src/lib/skin-navigator/prompt.ts`
- `web/src/lib/skin-navigator/ai.ts`
- `web/src/lib/skin-navigator/clinic-match.ts`
- `web/src/lib/skin-navigator/sessions.ts`
- `web/src/lib/skin-navigator/analytics.ts`

Database:

- `web/scripts/add-ai-navigator-tables.sql`
- `web/db/schema.sql`
- `web/scripts/schema.sql`

Landing and navigation links:

- `web/src/components/hero/hero-header.tsx`
- `web/src/components/hero/hero-section.tsx`

Global animation styles:

- `web/src/app/globals.css`

