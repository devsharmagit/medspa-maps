// Minimal hand-drawn brand glyphs — lucide-react has no social/brand icons
// (dropped from the package), so these are small stroke-style icons that match
// the rest of the page's icon language (Phone/MapPin/Clock etc. all use
// stroke="currentColor"). Not pixel-perfect logos — just clean, recognizable
// link icons.

function InstagramGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" />
    </svg>
  );
}

function FacebookGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M14 8h-1a2 2 0 0 0-2 2v1H9.5v2H11v5h2v-5h1.4l.3-2H13v-1a.5.5 0 0 1 .5-.5H14Z"
        fill="currentColor"
      />
    </svg>
  );
}

function TikTokGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M14 3v10.5a3.5 3.5 0 1 1-3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M14 6.5c1 1.6 2.4 2.5 4 2.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function YoutubeGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="2.5" y="6" width="19" height="12" rx="4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.5 9.5v5l4.5-2.5-4.5-2.5Z" fill="currentColor" />
    </svg>
  );
}

function XGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M5 5l14 14M19 5 5 19" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function LinkedinGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8" cy="9" r="1" fill="currentColor" />
      <path d="M8 11.5V17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M12 17v-4a2 2 0 0 1 4 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 11.5V17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function YelpGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 2 14.5 8.5 21 9.3 16 13.8 17.3 20.5 12 17 6.7 20.5 8 13.8 3 9.3 9.5 8.5Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export interface ClinicSocials {
  instagram_url?: string | null;
  facebook_url?: string | null;
  tiktok_url?: string | null;
  youtube_url?: string | null;
  x_url?: string | null;
  linkedin_url?: string | null;
  yelp_url?: string | null;
}

const SOCIAL_CONFIG: Array<{
  key: keyof ClinicSocials;
  label: string;
  Icon: (props: { className?: string }) => React.ReactElement;
}> = [
  { key: "instagram_url", label: "Instagram", Icon: InstagramGlyph },
  { key: "facebook_url", label: "Facebook", Icon: FacebookGlyph },
  { key: "tiktok_url", label: "TikTok", Icon: TikTokGlyph },
  { key: "youtube_url", label: "YouTube", Icon: YoutubeGlyph },
  { key: "x_url", label: "X (Twitter)", Icon: XGlyph },
  { key: "linkedin_url", label: "LinkedIn", Icon: LinkedinGlyph },
  { key: "yelp_url", label: "Yelp", Icon: YelpGlyph },
];

/** Row of circular social-media icon links; renders only the platforms the clinic has a URL for. */
export function ClinicSocialLinks({
  socials,
  className,
}: {
  socials: ClinicSocials;
  className?: string;
}) {
  const links = SOCIAL_CONFIG.filter((s) => socials[s.key]);
  if (links.length === 0) return null;

  return (
    <div className={`flex items-center gap-[10px] ${className ?? ""}`}>
      {links.map(({ key, label, Icon }) => (
        <a
          key={key}
          href={socials[key]!}
          target="_blank"
          rel="noreferrer"
          aria-label={label}
          title={label}
          className="flex size-9 items-center justify-center rounded-full border border-[#E5C7DA] text-[#CF5B9D] transition-colors hover:bg-[#CF5B9D] hover:text-white"
        >
          <Icon className="size-[18px]" />
        </a>
      ))}
    </div>
  );
}
