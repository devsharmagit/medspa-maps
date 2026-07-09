/**
 * Smoothly scrolls to the "list-your-medspa" section, rendered inside
 * ResourcesSection (itself always rendered as part of Footer). Shared so every
 * "list/partner your medspa" CTA site-wide does the exact same thing.
 */
export function scrollToListYourMedspa() {
  const element = document.getElementById("list-your-medspa");
  if (element) {
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}
