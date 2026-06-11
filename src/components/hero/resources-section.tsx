"use client";

import { Gem, Star, LifeBuoy } from "lucide-react";

// ─── ResourcesSection ─────────────────────────────────────────────────────────

export function ResourcesSection() {
  return (
    <section className="mx-auto flex w-full max-w-[1372px] flex-col lg:flex-row items-center justify-between gap-6 overflow-visible py-8 px-4 lg:px-0">
      {/* ── Left Card: Get Your medSpa listed ── */}
      <div
        className="relative flex w-full lg:w-[814px] h-auto lg:h-[546px] flex-col items-start rounded-[18px] border border-[#DEC6DF] overflow-hidden p-6 sm:p-10 lg:p-0"
        style={{
          backgroundImage: "url(/images/landingpage/gift-bg-whole.png)",
          backgroundSize: "107%",
          backgroundPosition: "center",
          boxShadow: "0px 8px 14px rgba(0, 0, 0, 0.02)",
        }}
      >
        {/* Text Block */}
        <div className="flex flex-col w-full lg:max-w-[512px] lg:absolute lg:left-[61px] lg:top-[65px] z-30">
          <h2
            className="font-montserrat font-medium leading-[116.02%] tracking-[-0.04em] text-[#99597A] text-[28px] sm:text-[39px]"
            style={{ lineHeight: "116.02%" }}
          >
            Get Your medSpa listed{" "}
            <span className="font-heading italic block sm:inline">& Get More Clients!</span>
          </h2>
          <p className="mt-4 font-montserrat font-medium text-[16px] sm:text-[18px] leading-[140%] text-[#353535] max-w-[432px]">
            List your clinic today and get a chance to be featured on our homepage!
          </p>
        </div>

        {/* Benefit Items List */}
        <div className="flex flex-col gap-[25px] w-full sm:max-w-[337px] mt-8 lg:mt-0 lg:absolute lg:left-[61px] lg:top-[246px] z-30">
          {/* Item 1 */}
          <div
            className="flex items-center gap-[9px] w-full h-[61px] pl-3 rounded-[10px]"
            style={{
              background: "linear-gradient(90deg, #FFFFFF 0%, rgba(255, 255, 255, 0) 100%)",
            }}
          >
            <div className="flex h-[35px] w-[35px] items-center justify-center text-[#CF5D9A]">
              <Gem className="h-6 w-6" strokeWidth={1.5} />
            </div>
            <div className="flex flex-col">
              <span className="font-montserrat font-medium text-[18px] leading-[140%] text-[#353535]">
                Free Premium Listing
              </span>
              <span className="font-montserrat font-medium text-[14px] leading-[140%] text-[#98889A]">
                For first 100 signups
              </span>
            </div>
          </div>

          {/* Item 2 */}
          <div
            className="flex items-center gap-[9px] w-full h-[61px] pl-3 rounded-[10px]"
            style={{
              background: "linear-gradient(90deg, #FFFFFF 0%, rgba(255, 255, 255, 0) 100%)",
            }}
          >
            <div className="flex h-[35px] w-[35px] items-center justify-center text-[#CF5D9A]">
              <Star className="h-6 w-6" strokeWidth={1.5} />
            </div>
            <div className="flex flex-col">
              <span className="font-montserrat font-medium text-[18px] leading-[140%] text-[#353535]">
                Featured on Homepage
              </span>
              <span className="font-montserrat font-medium text-[14px] leading-[140%] text-[#98889A]">
                Get maximum velocity
              </span>
            </div>
          </div>

          {/* Item 3 */}
          <div
            className="flex items-center gap-[9px] w-full h-[61px] pl-3 rounded-[10px]"
            style={{
              background: "linear-gradient(90deg, #FFFFFF 0%, rgba(255, 255, 255, 0) 100%)",
            }}
          >
            <div className="flex h-[35px] w-[35px] items-center justify-center text-[#CF5D9A]">
              <LifeBuoy className="h-6 w-6" strokeWidth={1.5} />
            </div>
            <div className="flex flex-col">
              <span className="font-montserrat font-medium text-[18px] leading-[140%] text-[#353535]">
                Priority Support
              </span>
              <span className="font-montserrat font-medium text-[14px] leading-[140%] text-[#98889A]">
                Dedicated account manager
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Card: Claim Your Benefits ── */}
      <div
        className="relative flex w-full lg:w-[535px] h-auto lg:h-[546px] flex-col items-center rounded-[18px] border border-[#DEC6DF] p-6 sm:p-10 lg:p-0"
        style={{
          background: "linear-gradient(147.33deg, #FCD1FF -144.24%, #FFFFFF 47.26%)",
          boxShadow: "0px 8px 14px rgba(0, 0, 0, 0.02)",
        }}
      >
        {/* Title Block */}
        <div className="flex flex-col items-center w-full lg:max-w-[432px] lg:absolute lg:left-[52px] lg:top-[49px] z-30">
          <h2
            className="font-montserrat font-medium leading-[116.02%] tracking-[-0.04em] text-[#99597A] text-[28px] sm:text-[32px] text-center"
            style={{ lineHeight: "116.02%" }}
          >
           List your medspa 
          </h2>
        </div>

        {/* Form Inputs (Desktop absolute, mobile mt-8) */}
        <form className="flex flex-col gap-[13px] w-full lg:max-w-[422px] mt-8 lg:mt-0 lg:absolute lg:left-[54px] lg:top-[170px] z-30">
          {/* Full Name */}
          <div className="flex h-[50px] w-full items-center rounded-[4px] border border-[#D2C3D3] bg-white px-[15px]">
            <input
              type="text"
              placeholder="Full Name"
              className="w-full font-montserrat text-[16px] leading-[140%] text-[#353535] placeholder-[#B5A4B6] bg-transparent border-none outline-none focus:ring-0"
              required
            />
          </div>

          {/* Business Email */}
          <div className="flex h-[50px] w-full items-center rounded-[4px] border border-[#D2C3D3] bg-white px-[15px]">
            <input
              type="email"
              placeholder="Business Email"
              className="w-full font-montserrat text-[16px] leading-[140%] text-[#353535] placeholder-[#B5A4B6] bg-transparent border-none outline-none focus:ring-0"
              required
            />
          </div>

          {/* Business Name */}
          <div className="flex h-[50px] w-full items-center rounded-[4px] border border-[#D2C3D3] bg-white px-[15px]">
            <input
              type="text"
              placeholder="Business Name"
              className="w-full font-montserrat text-[16px] leading-[140%] text-[#353535] placeholder-[#B5A4B6] bg-transparent border-none outline-none focus:ring-0"
              required
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="flex h-[53px] w-full items-center justify-center rounded-[8px] mt-4 font-montserrat font-semibold text-[18px] text-white cursor-pointer hover:opacity-90 active:scale-[0.99] transition-all"
            style={{
              background: "linear-gradient(90deg, #DE7F4C 0%, #C341D7 100%)",
            }}
          >
           Submit
          </button>
        </form>
      </div>
    </section>
  );
}
