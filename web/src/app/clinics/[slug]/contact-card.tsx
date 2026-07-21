import { Phone, MapPin, Globe, Navigation, Mail } from "lucide-react";
import { ClinicSocialLinks, type ClinicSocials } from "@/components/shared/clinic-social-links";

/**
 * "Contact Information" card — a compact, premium contact panel shown next to
 * the Hours card. Phone is a filled gradient pill (primary action); address,
 * email, website and directions are quieter links; socials sit in a row at
 * the bottom. Every row is optional and the whole card hides when the clinic
 * has no contact details at all.
 */
export function ClinicContactCard({
  phone,
  email,
  address,
  website,
  mapsUrl,
  socials,
}: {
  phone: string | null;
  email: string | null;
  address: string | null;
  website: string | null;
  mapsUrl: string | null;
  socials: ClinicSocials;
}) {
  const hasSocials = Object.values(socials).some(Boolean);
  if (!phone && !email && !address && !website && !mapsUrl && !hasSocials) return null;

  return (
    <div className="flex h-full w-full flex-col gap-[18px] rounded-[16px] border border-[#DEDEDE] bg-white p-6 shadow-[0px_9px_11.1px_rgba(240,223,241,0.6)]">
      <h3 className="font-fraunces italic text-[22px] font-normal leading-[116.02%] tracking-[-0.02em] text-[#373634]">
        Contact Information
      </h3>

      {phone && (
        <a
          href={`tel:${phone}`}
          className="inline-flex w-fit items-center gap-[10px] rounded-full bg-[linear-gradient(90deg,#DE7F4C_0%,#C341D7_100%)] px-[22px] py-[11px] transition-opacity hover:opacity-90"
        >
          <Phone className="h-[17px] w-[17px] shrink-0 text-white" strokeWidth={1.8} />
          <span className="font-montserrat text-[15px] font-semibold leading-none text-white">
            {phone}
          </span>
        </a>
      )}

      {address &&
        (mapsUrl ? (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-start gap-[10px] transition-colors hover:text-[#CF5B9D]"
          >
            <MapPin
              className="mt-[1px] h-[20px] w-[20px] shrink-0 text-[#EE97C6]"
              strokeWidth={1.5}
            />
            <span className="font-montserrat text-[14px] font-medium leading-[150%] tracking-[0.02em] text-[#616161] hover:text-[#CF5B9D]">
              {address}
            </span>
          </a>
        ) : (
          <div className="flex items-start gap-[10px]">
            <MapPin
              className="mt-[1px] h-[20px] w-[20px] shrink-0 text-[#EE97C6]"
              strokeWidth={1.5}
            />
            <span className="font-montserrat text-[14px] font-medium leading-[150%] tracking-[0.02em] text-[#616161]">
              {address}
            </span>
          </div>
        ))}

      {email && (
        <a
          href={`mailto:${email}`}
          className="flex w-fit items-center gap-[10px] text-[#CF5B9D] transition-opacity hover:opacity-70"
        >
          <Mail className="h-[18px] w-[18px] shrink-0" strokeWidth={1.6} />
          <span className="font-montserrat text-[14px] font-semibold leading-none">
            {email}
          </span>
        </a>
      )}

      {website && (
        <a
          href={website}
          target="_blank"
          rel="noreferrer"
          className="flex w-fit items-center gap-[10px] text-[#CF5B9D] transition-opacity hover:opacity-70"
        >
          <Globe className="h-[19px] w-[19px] shrink-0" strokeWidth={1.6} />
          <span className="font-montserrat text-[14px] font-semibold leading-none">
            Visit Website
          </span>
        </a>
      )}

      {mapsUrl && (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="flex w-fit items-center gap-[10px] text-[#CF5B9D] transition-opacity hover:opacity-70"
        >
          <Navigation className="h-[18px] w-[18px] shrink-0" strokeWidth={1.6} />
          <span className="font-montserrat text-[14px] font-semibold leading-none">
            Get Directions
          </span>
        </a>
      )}

      {hasSocials && (
        <div className="mt-[2px] border-t border-[#F0DDE8] pt-[16px]">
          <ClinicSocialLinks socials={socials} />
        </div>
      )}
    </div>
  );
}
