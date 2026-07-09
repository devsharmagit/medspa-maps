import Image from "next/image";
import Link from "next/link";

export function Newsletter() {
  return (
    <div className="relative mx-auto flex w-full max-w-[1372px] flex-col items-start gap-2.5 overflow-visible px-4 lg:px-0 lg:-mt-[90px] lg:-mb-[90px] z-10">
      {/* Card Wrapper */}
      <div
        className="relative flex w-full h-auto lg:h-[210px] flex-col justify-center items-start rounded-[18px] border border-[#CB97CE] overflow-hidden px-6 py-10 sm:px-10 lg:pl-16 lg:pr-8 gap-6"
        style={{
          background: "linear-gradient(252.15deg, #DC7A58 3.19%, #EDA5F2 76.45%)",
          boxShadow: "0px 8px 14px rgba(0, 0, 0, 0.02)",
        }}
      >
        {/* Background Image of Faces (Right Aligned, blended via luminosity) */}
        <div className="absolute right-0 top-0 h-full w-full lg:w-[55%] pointer-events-none select-none overflow-hidden rounded-r-[18px] z-0 opacity-30 sm:opacity-40">
          <Image
            src="/images/landingpage/newsletter-bg.png"
            alt=""
            fill
            className="object-cover object-right mix-blend-luminosity"
            sizes="(max-width: 1024px) 100vw, 55vw"
            priority
          />
        </div>

        {/* Left Column Stack (Text & CTA together) */}
        <div className="relative flex flex-col items-start gap-4 lg:gap-[13px] max-w-full lg:max-w-[900px] z-10">
          <div className="flex flex-col items-start justify-center gap-[10px] w-full">
            <h2
              className="font-montserrat font-medium text-white text-[24px] sm:text-[36px] lg:text-[44px] leading-[116.02%] tracking-[-0.04em] mt-[-4px] mb-[-4px]"
              style={{ lineHeight: "116.02%" }}
            >
              Find Your <span className="font-heading italic">Perfect Med Spa</span>
            </h2>
            <p className="font-montserrat font-medium text-white/90 text-[14px] sm:text-[16px] leading-[140%] tracking-[-0.02em] max-w-[520px]">
              Discover trusted clinics, compare treatments, and book your next
              appointment with confidence.
            </p>
          </div>

          {/* Single CTA */}
          <Link
            href="/search"
            className="flex h-[53px] w-full sm:w-[200px] items-center justify-center rounded-[8px] font-montserrat font-semibold text-[16px] text-white cursor-pointer transition-all hover:opacity-90 active:scale-[0.99]"
            style={{
              background: "linear-gradient(90deg, #DE7F4C 0%, #C341D7 100%)",
            }}
          >
            Explore Clinics
          </Link>
        </div>
      </div>
    </div>
  );
}
