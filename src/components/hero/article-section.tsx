"use client";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState, useEffect } from "react";

const categories = [
  { name: "Treatments", count: 24 },
  { name: "Skin Care", count: 15 },
  { name: "Wellness", count: 56 },
  { name: "Business Tips", count: 22 },
  { name: "Patient Guide", count: 15 },
];

const articles = [
  {
    category: "Treatments",
    title: "Benefits of Laser Hair Treatments",
    meta: "May 12, 2026 - 5 min read",
  },
  {
    category: "Treatments",
    title: "Ultimate Guide to Botox & Fillers",
    meta: "Jun 04, 2026 - 8 min read",
  },
  {
    category: "Treatments",
    title: "Laser Hair Removal: What to Expect",
    meta: "May 18, 2026 - 4 min read",
  },
];

const popularTopics = ["Botox", "Fillers", "Laser Treatments", "Acne", "Anti Aging"];

export function ArticleSection() {
  const [searchQuery, setSearchQuery] = useState("");
  const articlesScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScrollLimits = () => {
    const container = articlesScrollRef.current;
    if (container) {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      setCanScrollLeft(scrollLeft > 2);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
    }
  };

  useEffect(() => {
    const container = articlesScrollRef.current;
    if (container) {
      container.addEventListener("scroll", checkScrollLimits);
      checkScrollLimits();
      window.addEventListener("resize", checkScrollLimits);
    }
    return () => {
      if (container) {
        container.removeEventListener("scroll", checkScrollLimits);
      }
      window.removeEventListener("resize", checkScrollLimits);
    };
  }, []);

  const handleScroll = (direction: "left" | "right") => {
    const container = articlesScrollRef.current;
    if (container) {
      const scrollAmount = 283; // scroll by roughly one card (267px + 16px gap)
      const targetScroll =
        direction === "left"
          ? container.scrollLeft - scrollAmount
          : container.scrollLeft + scrollAmount;

      container.scrollTo({
        left: targetScroll,
        behavior: "smooth",
      });
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Searching articles for:", searchQuery);
  };

  return (
    <section className="mx-auto flex w-full max-w-[1372px] pb-[120px] flex-col items-center justify-center py-6 px-4 lg:px-0">
      {/* Outer Card Container */}
      <div
        className="relative flex w-full h-auto lg:h-[393px] flex-col lg:flex-row items-center justify-start rounded-[18px] border border-[#DEC6DF] overflow-hidden px-4 py-8 lg:p-0"
        style={{
          background: "linear-gradient(210.9deg, #FCD1FF -132.87%, #FFFFFF 43.51%)",
          boxShadow: "0px 8px 14px rgba(0, 0, 0, 0.02)",
        }}
      >
        {/* Left Column: Search & Topic Knowledge Hub */}
        <div
          className="relative flex w-full lg:w-[408px] h-auto lg:h-[314px] flex-col justify-center items-start rounded-[14px] px-5 py-6 lg:py-0 lg:absolute lg:left-[36px] lg:top-[39px] z-20 "
          style={{
            background: "linear-gradient(111.82deg, #FFFFFF 33.27%, #EDD8EF 159.97%)",
          }}
        >
          {/* Header Text Stack */}
          <div className="flex flex-col items-start gap-[9px] w-full">
            <h3 className="font-montserrat font-medium text-[#99597A] text-[24px] sm:text-[29px] leading-[116.02%] tracking-[-0.04em] w-full">
              Your Resource for Expert{" "}
              <span className="font-heading italic block sm:inline">MedSpa knowledge!</span>
            </h3>
            <p className="font-montserrat font-normal text-[14px] leading-[140%] text-[#353535] max-w-[337px]">
              In-depth guide, expert tips and the latest insight to help you make informed decisions.
            </p>
          </div>

          {/* Search Box */}
          <form
            onSubmit={handleSearchSubmit}
            className="flex items-center justify-between w-full sm:max-w-[369px] h-[50px] bg-white border border-[#D2C3D3] rounded-[8px] px-[15px] mt-5"
          >
            <input
              type="text"
              placeholder="Search articles, topics, treatments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full font-montserrat text-[14px] text-[#353535] placeholder-[#886A7B] bg-transparent border-none outline-none focus:ring-0"
            />
            <button type="submit" className="text-[#99597A] p-1 cursor-pointer hover:opacity-85">
              <Search className="h-5 w-5" strokeWidth={2} />
            </button>
          </form>

          {/* Popular Topics Tags */}
          <div className="flex flex-col gap-[9px] w-full mt-[18px]">
            <span className="font-montserrat font-semibold text-[14px] leading-[140%] text-[#353535]">
              Popular Topics
            </span>
            <div className="flex flex-wrap gap-1.5 w-full">
              {popularTopics.map((topic, index) => (
                <Link
                  href={`/blog/topic/${topic.toLowerCase().replace(/\s+/g, "-")}`}
                  key={index}
                  className="flex justify-center items-center h-[26px] bg-[#E2CCE2] rounded-[6px] px-2.5 py-[4px] font-montserrat font-medium text-[12px] text-[#353535] transition-colors hover:bg-[#d5b5d5]"
                >
                  {topic}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column Content Stack (Visible and formatted correctly for desktops/mobiles) */}
        <div className="flex flex-col w-full lg:w-[839px] gap-4 mt-8 lg:mt-0 lg:absolute lg:left-[490px] lg:top-[26px] z-10">
          
          {/* Categories Grid (Top Row) */}
          <div className="flex w-full gap-[11px]  pb-2 scrollbar-none snap-x snap-mandatory">
            {categories.map((cat, idx) => (
              <div
                key={idx}
                className="relative w-[159px] h-[156px] shrink-0 snap-start"
              >
                {/* Stacked card overlays */}
                <div className="absolute left-[6px] right-[5px] top-[11px] h-[131px] rounded-[22px] border border-[#E9E9E9]/60 bg-white/40 shadow-[0px_6px_10.5px_1px_rgba(0,0,0,0.05)] z-0" />
                <div className="absolute left-[3px] right-[3px] top-[18px] h-[121px] rounded-[22px] border border-[#E9E9E9]/80 bg-white/60 shadow-[0px_6px_10.5px_1px_rgba(0,0,0,0.05)] z-10" />
                {/* Main front card */}
                <div className="absolute left-0 right-0 top-[24px] h-[132px] rounded-[22px] bg-white border border-[#F3E5F5]/30 shadow-[0px_6px_10.5px_1px_rgba(0,0,0,0.05)] z-20 flex flex-col items-center pt-[22px] px-2">
                  <div className="flex h-[43px] w-[43px] items-center justify-center relative">
                    <Image
                      src="/images/landingpage/star-svg.svg"
                      alt="Star Icon"
                      width={35}
                      height={31}
                      className="object-contain"
                      style={{ height: "auto" }}
                    />
                  </div>
                  <div className="flex flex-col items-center gap-[3px] w-full">
                    <span className="font-montserrat font-medium text-[15px] leading-[116.02%] tracking-[0.02em] text-[#393939] text-center w-full truncate">
                      {cat.name}
                    </span>
                    <span className="font-montserrat font-normal text-[12px] leading-[138%] tracking-[0.02em] text-[#727272] text-center">
                      {cat.count} Articles
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Latest Articles Header (Middle Row) */}
          <div className="flex w-full items-center justify-between mt-2 px-1">
            <h4 className="font-montserrat font-medium text-[18px] leading-[116.02%] text-[#373634]">
              Latest Articles
            </h4>

            {/* View All & navigation capsule */}
            <div className="flex items-center gap-[32px] h-[31px]">
              <Link
                href="/blog"
                className="group flex items-center gap-[5px] h-[19px]"
              >
                <span className="font-montserrat font-medium text-[16px] leading-[116.02%] text-[#CF5D9A]">
                  View All Articles
                </span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="inline-block transition-transform group-hover:translate-x-1"
                >
                  <path
                    d="M3.33331 8H12.6666M12.6666 8L8 3.33331M12.6666 8L8 12.6666"
                    stroke="#CF5D9A"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>

              {/* Slider Arrow Capsule */}
              <div className="flex items-center gap-[3px] h-[31px]">
                <button
                  onClick={() => handleScroll("left")}
                  disabled={!canScrollLeft}
                  className={`box-sizing-border-box flex h-[31px] w-[40px] justify-center items-center rounded-l-[99px] rounded-r-none border border-[#DEC6DF] bg-white transition-all ${
                    canScrollLeft
                      ? "cursor-pointer hover:bg-pink-50 active:scale-95"
                      : "opacity-40 cursor-default"
                  }`}
                  aria-label="Scroll left"
                >
                  <ChevronLeft className="h-4.5 w-4.5 text-[#CF5D9A]" />
                </button>

                <button
                  onClick={() => handleScroll("right")}
                  disabled={!canScrollRight}
                  className={`box-sizing-border-box flex h-[31px] w-[40px] justify-center items-center rounded-r-[99px] rounded-l-none border border-[#DEC6DF] bg-white transition-all ${
                    canScrollRight
                      ? "cursor-pointer hover:bg-pink-50 active:scale-95"
                      : "opacity-40 cursor-default"
                  }`}
                  aria-label="Scroll right"
                >
                  <ChevronRight className="h-4.5 w-4.5 text-[#CF5D9A]" />
                </button>
              </div>
            </div>
          </div>

          {/* Latest Articles Cards Row (Bottom Row) */}
          <div
            ref={articlesScrollRef}
            className="flex w-full gap-[16px] overflow-x-auto pb-4 scroll-smooth scrollbar-none snap-x snap-mandatory px-1"
            onScroll={checkScrollLimits}
          >
            {articles.map((art, index) => (
              <Link
                href={`/blog/${art.title.toLowerCase().replace(/\s+/g, "-")}`}
                key={index}
                className="relative flex h-[108px] w-[267px] shrink-0 items-center justify-start rounded-[12px] border border-[#ECDDED] overflow-hidden shadow-[0px_8px_14px_rgba(0,0,0,0.02)] snap-start hover:border-[#CB97CE] hover:shadow-[0px_8px_16px_rgba(203,151,206,0.08)] transition-all"
                style={{
                  background: "linear-gradient(126.81deg, #FCD1FF -96.14%, #FFFFFF 49.94%)",
                }}
              >
                {/* Article Image Cover */}
                <div className="relative w-[74px] h-[108px] shrink-0 rounded-l-[10px] overflow-hidden bg-[#F3E5F5]">
                  <Image
                    src="/images/landingpage/artical-img.png"
                    alt={art.title}
                    fill
                    className="object-cover"
                    sizes="74px"
                  />
                </div>

                {/* Right side Text Stack */}
                <div className="flex flex-col flex-1 pl-[15px] pr-2.5 py-[13px] justify-between h-full overflow-hidden">
                  <div className="flex flex-col gap-0.5 w-full">
                    <span className="font-montserrat font-semibold text-[10px] leading-[130%] tracking-[0.02em] text-[#AC467B] uppercase">
                      {art.category}
                    </span>
                    <h5 className="font-montserrat font-medium text-[14px] leading-[130%] tracking-[0.02em] text-[#393939] line-clamp-2 w-full">
                      {art.title}
                    </h5>
                  </div>
                  <span className="font-montserrat font-normal text-[10px] leading-[138%] tracking-[0.02em] text-[#727272]">
                    {art.meta}
                  </span>
                </div>
              </Link>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}
