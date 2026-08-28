/**
 * Renders a JSON-LD structured-data <script>. Centralizes the
 * `dangerouslySetInnerHTML` + safe-escaping pattern that was previously
 * hand-written per page.
 */
export function JsonLd({ data }: { data: object }) {
  // Escape "<" so a stray "</script>" inside any string can't break out of the
  // tag (standard JSON-LD hardening).
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
