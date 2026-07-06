"use client";

import Link from "next/link";
import { useState } from "react";

import { ResourcesSection } from "@/components/hero/resources-section";
import { Newsletter } from "@/components/hero/newsletter";

export function Footer() {
  const [bottomEmail, setBottomEmail] = useState("");

  const handleBottomSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Bottom subscription:", bottomEmail);
  };

  return (
    <>
      <div className="w-full flex flex-col items-center relative z-10 mt-10">
        <ResourcesSection />
        <div className="h-10 lg:h-32 w-full" /> {/* Spacer to handle negative margins */}
        <Newsletter />
      </div>
      <footer className="w-full bg-[#3D2E38] pt-20 lg:pt-[187px] pb-[50px] px-4 flex justify-center items-center relative z-0">
      {/* Inner Content Wrapper */}
      <div className="flex flex-col items-start gap-[89px] w-full max-w-[1291px]">
        
        {/* Top Row: Links and Newsletter */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end w-full gap-12 lg:gap-8">
          
          {/* Left: Link Columns */}
          <div className="flex flex-row items-start gap-12 sm:gap-[122px] w-full lg:w-auto">
            {/* Column 1 */}
            <div className="flex flex-col items-start gap-[23px] w-[135px] shrink-0">
              <Link
                href="/search"
                className="font-montserrat font-medium text-[14px] leading-[180%] tracking-[0.02em] text-[#C4C4C4] uppercase transition-colors hover:text-white"
              >
                Find a Medspa
              </Link>
              <Link
                href="/treatments"
                className="font-montserrat font-medium text-[14px] leading-[180%] tracking-[0.02em] text-[#C4C4C4] uppercase transition-colors hover:text-white"
              >
                Treatments A-Z
              </Link>
              <Link
                href="/conditions"
                className="font-montserrat font-medium text-[14px] leading-[180%] tracking-[0.02em] text-[#C4C4C4] uppercase transition-colors hover:text-white"
              >
                Conditions
              </Link>
              <Link
                href="/providers"
                className="font-montserrat font-medium text-[14px] leading-[180%] tracking-[0.02em] text-[#C4C4C4] uppercase transition-colors hover:text-white"
              >
                Providers
              </Link>
            </div>

            {/* Column 2 */}
            <div className="flex flex-col items-start gap-[23px] w-[170px] shrink-0">
              <Link
                href="/best-of-2026"
                className="font-montserrat font-medium text-[14px] leading-[180%] tracking-[0.02em] text-[#C4C4C4] uppercase transition-colors hover:text-white"
              >
                Best of 2026
              </Link>
              <Link
                href="/get-free-listings"
                className="font-montserrat font-medium text-[14px] leading-[180%] tracking-[0.02em] text-[#C4C4C4] uppercase transition-colors hover:text-white"
              >
                Partner with us
              </Link>
              <Link
                href="/for-providers"
                className="font-montserrat font-medium text-[14px] leading-[180%] tracking-[0.02em] text-[#C4C4C4] uppercase transition-colors hover:text-white"
              >
                For providers
              </Link>
            </div>
          </div>

          {/* Right: Underline Newsletter */}
          <div className="flex flex-col items-start gap-[10px] w-full lg:max-w-[619px] z-10">
            <p className="font-montserrat font-medium text-[14px] leading-[180%] tracking-[0.02em] text-[#C4C4C4]">
              Subscribe to our newsletter and for important news and Updates
            </p>
            
            <form
              onSubmit={handleBottomSubscribe}
              className="flex items-center w-full max-w-[580px] h-[50px] border-b border-[#E2C5B2] pb-1.5 mt-2.5 relative"
            >
              <input
                type="email"
                placeholder="Enter Email Address"
                value={bottomEmail}
                onChange={(e) => setBottomEmail(e.target.value)}
                className="flex-1 bg-transparent font-montserrat text-[14px] text-white placeholder-[#909090] tracking-[0.06em] outline-none border-none py-2"
                required
              />
              <button
                type="submit"
                className="flex h-[43px] w-[72px] items-center justify-center rounded-[8px] font-montserrat font-semibold text-[16px] text-white cursor-pointer transition-all hover:opacity-90 active:scale-95 ml-3"
                style={{
                  background: "linear-gradient(90deg, #DE7F4C 0%, #C341D7 100%)",
                }}
              >
                GO
              </button>
            </form>
          </div>

        </div>

        {/* Bottom Divider & Copyright Row */}
        <div className="flex flex-col items-start gap-[34px] w-full">
          {/* Divider Line */}
          <div className="w-full h-px bg-[#EB8A4D]" />

          {/* Copyright Section */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full">
            <p className="font-montserrat font-medium text-[14px] leading-[180%] tracking-[0.02em] text-[#C4C4C4] uppercase text-center sm:text-left">
              Medspa Maps © 2026. All Rights Reserved. Privacy Policy | Terms & Condition
            </p>
          </div>
        </div>

      </div>
    </footer>
    </>
  );
}
