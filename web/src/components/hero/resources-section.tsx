import { Gem, Star, LifeBuoy } from "lucide-react";
import Script from "next/script";

// ─── ResourcesSection ─────────────────────────────────────────────────────────

export function ResourcesSection() {
  return (
    <section 
      id="list-your-medspa"
      className="mx-auto flex w-full max-w-[1372px] flex-col min-[1400px]:flex-row items-center justify-between gap-6 overflow-visible py-8 px-4 min-[1400px]:px-0"
    >
      {/* ── Left Card: Get Your medSpa listed ── */}
      <div
        className="relative flex w-full min-[1400px]:w-[814px] h-auto min-[1400px]:h-[546px] flex-col items-start rounded-[18px] border border-[#DEC6DF] overflow-hidden p-6 sm:p-10 min-[1400px]:p-0 bg-[linear-gradient(145deg,#F5CFFA_0%,#FAE3F9_50%,#FFFFFF_100%)] bg-no-repeat min-[1400px]:bg-[url(/images/landingpage/gift-bg-whole.png)] min-[1400px]:bg-[length:107%] min-[1400px]:bg-center"
        style={{
          boxShadow: "0px 8px 14px rgba(0, 0, 0, 0.02)",
        }}
      >
        {/* Text Block */}
        <div className="flex flex-col w-full min-[1400px]:max-w-[512px] min-[1400px]:absolute min-[1400px]:left-[61px] min-[1400px]:top-[65px] z-30">
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
        <div className="flex flex-col gap-[25px] w-full sm:max-w-[337px] mt-8 min-[1400px]:mt-0 min-[1400px]:absolute min-[1400px]:left-[61px] min-[1400px]:top-[246px] z-30">
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
        className="relative flex w-full min-[1400px]:w-[535px] h-auto min-[1400px]:h-[546px] flex-col items-center justify-center rounded-[18px] border border-[#DEC6DF] p-6 sm:p-10 min-[1400px]:p-0"
        style={{
          background: "linear-gradient(147.33deg, #FCD1FF -144.24%, #FFFFFF 47.26%)",
          boxShadow: "0px 8px 14px rgba(0, 0, 0, 0.02)",
        }}
      >
        {/* Title Block */}
        <div className="flex flex-col items-center w-full min-[1400px]:max-w-[432px] min-[1400px]:absolute min-[1400px]:left-[52px] min-[1400px]:top-[49px] z-30">
          <h2
            className="font-montserrat font-medium leading-[116.02%] tracking-[-0.04em] text-[#99597A] text-[28px] sm:text-[32px] text-center"
            style={{ lineHeight: "116.02%" }}
          >
           List your medspa 
          </h2>
        </div>

        {/* Growth99 Form Widget (Desktop absolute, mobile mt-8) */}
        <div className="w-[432px] h-[250px] justify-center flex justify-center mt-8 min-[1400px]:mt-0 min-[1400px]:absolute min-[1400px]:left-[54px] min-[1400px]:top-[170px] z-30">
          <Script src="https://app.growth99.com/assets/js/form-tracking.js" strategy="afterInteractive" />
          <div
            className="w-full min-[1400px]:w-[500px]"
            style={{ maxWidth: "500px", aspectRatio: "500 / 610" }}
          >
            <iframe
              style={{ width: "100%", height: "100%", border: 0 }}
              src="https://widget-ui.growth99.com/assets/widgets/new-form.html?bid=NDA2Mw==&fid=MjEyMjE="
              title="Review Form"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
