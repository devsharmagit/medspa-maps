"use client";

import { ChevronRight, Search, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const categories = [
  {
    id: 1,
    name: "Treatments",
    articleCount: 24,
    icon: <Sparkles className="h-6 w-6 text-[#CF5D9A]" />,
  },
  {
    id: 2,
    name: "Skin Care",
    articleCount: 15,
    icon: <Sparkles className="h-6 w-6 text-[#CF5D9A]" />,
  },
  {
    id: 3,
    name: "Wellness",
    articleCount: 56,
    icon: <Sparkles className="h-6 w-6 text-[#CF5D9A]" />,
  },
  {
    id: 4,
    name: "Business Tips",
    articleCount: 22,
    icon: <Sparkles className="h-6 w-6 text-[#CF5D9A]" />,
  },
  {
    id: 5,
    name: "Patient Guide",
    articleCount: 15,
    icon: <Sparkles className="h-6 w-6 text-[#CF5D9A]" />,
  },
];

const popularTopics = [
  "Botox",
  "Fillers",
  "Laser Treatments",
  "Acne",
  "Anti Aging",
];

const latestArticles = [
  {
    id: 1,
    category: "TREATMENTS",
    title: "Benefits of Laser Hair Treatments",
    date: "May 12, 2026",
    readTime: "5 min read",
    image: "/images/hero/bg-overlay-1.jpg",
  },
  {
    id: 2,
    category: "TREATMENTS",
    title: "Benefits of Laser Hair Treatments",
    date: "May 12, 2026",
    readTime: "6 min read",
    image: "/images/hero/bg-overlay-2.png",
  },
  {
    id: 3,
    category: "TREATMENTS",
    title: "Benefits of Laser Hair Treatments",
    date: "May 12, 2026",
    readTime: "5 min read",
    image: "/images/hero/bg-overlay-1.jpg",
  },
];

function CategoryCard({
  name,
  articleCount,
  icon,
}: {
  name: string;
  articleCount: number;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href="#"
      className="flex h-[100px] w-[120px] shrink-0 flex-col items-center justify-center gap-2 rounded-2xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F9E9FC]">
        {icon}
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-center font-montserrat text-sm font-medium text-[#383838]">
          {name}
        </span>
        <span className="text-center font-montserrat text-xs text-[#9A9A9A]">
          {articleCount} Articles
        </span>
      </div>
    </Link>
  );
}

function ArticleCard({
  article,
}: {
  article: (typeof latestArticles)[0];
}) {
  return (
    <Link
      href="#"
      className="flex w-[280px] shrink-0 flex-col gap-3 transition-transform hover:scale-[1.02]"
    >
      {/* Image */}
      <div className="relative h-[160px] w-full overflow-hidden rounded-xl">
        <Image
          src={article.image}
          alt={article.title}
          fill
          className="object-cover"
        />
      </div>

      {/* Content */}
      <div className="flex flex-col gap-2">
        {/* Category Badge */}
        <span className="w-fit rounded bg-[#F5F0F7] px-2 py-0.5 font-montserrat text-xs font-semibold uppercase tracking-wide text-[#CF5D9A]">
          {article.category}
        </span>

        {/* Title */}
        <h3 className="font-montserrat text-base font-medium leading-tight text-[#383838]">
          {article.title}
        </h3>

        {/* Meta */}
        <div className="flex items-center gap-2 font-montserrat text-xs text-[#9A9A9A]">
          <span>{article.date}</span>
          <span>•</span>
          <span>{article.readTime}</span>
        </div>
      </div>
    </Link>
  );
}

export function ResourcesSection() {
  return (
    <section className="flex w-full max-w-[1372px] flex-col gap-8 rounded-3xl bg-gradient-to-br from-[#FAF8FB] to-[#F5F0F7] p-12">
      {/* Header Section */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        {/* Left - Title and Description */}
        <div className="flex flex-col gap-3">
          <h2 className="font-montserrat text-[32px] font-normal leading-tight text-[#8B6E7F]">
            Your Resource for Expert
          </h2>
          <h3 className="font-heading text-[36px] italic leading-tight text-[#8B6E7F]">
            MedSpa Knowledge!
          </h3>
          <p className="max-w-md font-montserrat text-sm leading-relaxed text-[#8B6E7F]">
            In-depth guide, expert tips and the latest insight to help you make
            informed decisions.
          </p>
        </div>

        {/* Right - Search Bar */}
        <div className="relative w-full max-w-md">
          <input
            type="text"
            placeholder="Search articles, topics, treatments..."
            className="w-full rounded-full border border-[#E8D5E8] bg-white px-5 py-3 pr-12 font-montserrat text-sm text-[#6B4A6B] placeholder-[#B8A8B8] transition-colors focus:border-[#CF5D9A] focus:outline-none"
          />
          <button
            className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-[#CF5D9A] transition-opacity hover:opacity-90"
            aria-label="Search"
          >
            <Search className="h-4 w-4 text-white" />
          </button>
        </div>
      </div>

      {/* Categories */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-8 overflow-x-auto pb-2 scrollbar-none">
          {categories.map((category) => (
            <CategoryCard key={category.id} {...category} />
          ))}
        </div>
      </div>

      {/* Popular Topics */}
      <div className="flex flex-col gap-3">
        <h4 className="font-montserrat text-sm font-semibold text-[#8B6E7F]">
          Popular Topics
        </h4>
        <div className="flex flex-wrap gap-2">
          {popularTopics.map((topic) => (
            <Link
              key={topic}
              href="#"
              className="rounded-full bg-[#E8D5E8] px-4 py-1.5 font-montserrat text-sm text-[#6B4A6B] transition-colors hover:bg-[#CF5D9A] hover:text-white"
            >
              {topic}
            </Link>
          ))}
        </div>
      </div>

      {/* Latest Articles */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h4 className="font-montserrat text-lg font-semibold text-[#8B6E7F]">
            Latest Articles
          </h4>
          <Link
            href="#"
            className="flex items-center gap-2 transition-opacity hover:opacity-70"
          >
            <span className="font-montserrat text-sm font-medium text-[#CF5D9A]">
              View All Articles
            </span>
            <ChevronRight className="h-4 w-4 text-[#CF5D9A]" />
          </Link>
        </div>

        {/* Articles Grid */}
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
          {latestArticles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      </div>
    </section>
  );
}
