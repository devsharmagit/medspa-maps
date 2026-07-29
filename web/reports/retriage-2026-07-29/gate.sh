#!/usr/bin/env bash
# gate.sh — orchestrator-side mechanical checks on classification verdicts.
# Trusts nothing an agent asserted. Run from the run directory.
#
#   ./gate.sh            # check every verdict on disk
#   ./gate.sh a.com b.com
set -uo pipefail
cd "$(dirname "$0")"

# bash 3.2 (macOS default) has no mapfile/readarray.
TARGETS=""
if [ "$#" -gt 0 ]; then
  TARGETS="$*"
else
  TARGETS=$(ls verdicts/*.json 2>/dev/null | xargs -n1 basename | sed 's/\.json$//' | tr '\n' ' ')
fi

# Aesthetic vocabulary — any hit inside an EXCLUDE's own digest is suspicious and
# forces re-review. Expected to fire on training academies (they teach Botox), so
# it escalates rather than auto-flips.
# Word-boundary anchored: without \b, short tokens matched inside unrelated words
# ("ipl" in multiple/discipline/principal, "prp" in corpration typos, "lash" in
# flash) and every EXCLUDE lit up with meaningless warnings.
AESTHETIC='\b(botox|dysport|xeomin|jeuveau|daxxify|neurotoxin|neuromodulator|fillers?|juvederm|restylane|sculptra|kybella|microneedling|hydrafacial|dermaplaning|chemical peels?|laser hair removal|ipl|bbl|coolsculpting|morpheus8|emsculpt|prp|prf|facials?|manicures?|pedicures?|waxing|eyelash(es)?|lash (lift|extensions|tint)|microblading|facelift|face lift|rhinoplasty|blepharoplasty|liposuction|tummy tuck|breast augmentation|abdominoplasty|body contouring|skin tightening|med ?spa|medical aesthetics)\b'

fail=0; warn=0
printf '%-40s %-11s %-9s %s\n' DOMAIN VERDICT QUOTES NOTES
printf '%s\n' "----------------------------------------------------------------------------------------"
for d in $TARGETS; do
  f="verdicts/$d.json"
  notes=""
  if [ ! -f "$f" ]; then printf '%-40s %-11s %-9s %s\n' "$d" "MISSING" "-" "no verdict file"; fail=$((fail+1)); continue; fi
  if ! jq -e . "$f" >/dev/null 2>&1; then printf '%-40s %-11s %-9s %s\n' "$d" "BADJSON" "-" "does not parse"; fail=$((fail+1)); continue; fi

  v=$(jq -r '.verdict // "?"' "$f")
  conf=$(jq -r '.confidence // "?"' "$f")
  rc=$(jq -r '.exclusion_reason_code // ""' "$f")
  nev=$(jq -r '(.aesthetic_evidence // []) | length' "$f")

  # ---- quote verification: every quote must be verbatim in a digest for THIS domain
  qtotal=0; qbad=0
  while IFS= read -r q; do
    [ -z "$q" ] && continue
    qtotal=$((qtotal+1))
    if ! grep -qF -- "$q" digests/"$d"/*.txt 2>/dev/null; then
      qbad=$((qbad+1)); notes+="FABRICATED_QUOTE[${q:0:44}] "
    fi
  done < <(jq -r '(.aesthetic_evidence // [])[].quote // empty' "$f")
  qs="$((qtotal-qbad))/$qtotal"
  [ "$qbad" -gt 0 ] && fail=$((fail+1))

  # ---- schema rules
  [ "$v" = "INCLUDE" ] && [ "$nev" -eq 0 ] && { notes+="INCLUDE_WITHOUT_EVIDENCE "; fail=$((fail+1)); }
  [ "$v" = "INCLUDE" ] && [ -z "$(jq -r '.clinic_type // ""' "$f")" ] && { notes+="INCLUDE_WITHOUT_clinic_type "; fail=$((fail+1)); }
  [ "$v" = "EXCLUDE" ] && [ -z "$rc" ] && { notes+="EXCLUDE_WITHOUT_reason_code "; fail=$((fail+1)); }
  [ "$v" = "EXCLUDE" ] && [ "$conf" = "low" ] && { notes+="EXCLUDE_AT_LOW_CONFIDENCE "; fail=$((fail+1)); }
  [ "$v" = "EXCLUDE" ] && [ -z "$(jq -r '.proposed_markdown_reason // ""' "$f")" ] && { notes+="EXCLUDE_WITHOUT_markdown_reason "; fail=$((fail+1)); }

  # ---- homepage-only rule for NO_AESTHETIC_SERVICES
  if [ "$rc" = "NO_AESTHETIC_SERVICES" ]; then
    deep=$(jq -r '[(.probe.pages_read // [])[] | select(. != "/" and . != "")] | length' "$f")
    [ "$deep" -eq 0 ] && { notes+="NO_AESTHETIC_FROM_HOMEPAGE_ONLY "; fail=$((fail+1)); }
  fi

  # ---- counter-grep: aesthetic vocabulary inside an EXCLUDE's digest
  if [ "$v" = "EXCLUDE" ] && [ "$rc" != "DEAD_SITE" ] && [ "$rc" != "PLACEHOLDER_COMING_SOON" ]; then
    hits=$(grep -ohiE "$AESTHETIC" digests/"$d"/*.txt 2>/dev/null | sort -u | head -6 | paste -sd, - || true)
    [ -n "$hits" ] && { notes+="COUNTERGREP[$hits] "; warn=$((warn+1)); }
  fi

  printf '%-40s %-11s %-9s %s\n' "$d" "$v" "$qs" "${notes:-ok}"
done
printf '%s\n' "----------------------------------------------------------------------------------------"
echo "hard failures: $fail   counter-grep warnings (need eyeballing): $warn"
