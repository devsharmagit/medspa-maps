"use client";

import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";

function useIntersectionObserver(options: IntersectionObserverInit = {}) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Store options in a ref to avoid needing them in the dependency array
  const optionsRef = useRef(options);

  useEffect(() => {
    if (!ref.current) return;
    
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && entry.intersectionRatio >= (Number(optionsRef.current.threshold) || 0)) {
        setIsIntersecting(true);
        observer.unobserve(entry.target);
      }
    }, optionsRef.current);

    observer.observe(ref.current);
    
    return () => observer.disconnect();
  }, []);

  return [ref, isIntersecting] as const;
}

function CountUp({
  end,
  suffix = "",
  duration = 2000,
  start = false,
  isDecimal = false,
}: {
  end: number;
  suffix?: string;
  duration?: number;
  start: boolean;
  isDecimal?: boolean;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!start) return;

    let startTime: number | null = null;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = timestamp - startTime;
      const percentage = Math.min(progress / duration, 1);
      
      // easeOutExpo for a premium feeling deceleration
      const ease = percentage === 1 ? 1 : 1 - Math.pow(2, -10 * percentage);
      
      setCount(end * ease);

      if (progress < duration) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        setCount(end);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration, start]);

  const display = isDecimal ? count.toFixed(1) : Math.floor(count).toLocaleString();
  return <>{display}{suffix}</>;
}

const stats: Array<{ value: number; suffix: string; label: string; isDecimal?: boolean }> = [
  { value: 100, suffix: "+", label: "Verified Clinics" },
  { value: 100, suffix: "+", label: "Cities Covered" },
  { value: 48, suffix: "", label: "States Represented" },
  { value: 100, suffix: "%", label: "PERSONALIZED CARE" },
];

export default function StatsSection() {
  const [ref, isVisible] = useIntersectionObserver({ threshold: 0.5 });

  return (
    <section ref={ref} className="w-full flex flex-col items-center justify-center py-12 lg:py-16 gap-8 lg:gap-[25px] px-4 overflow-hidden">
      {/* Heading */}
      <h2
        className={cn(
          "w-full text-center text-[30px] sm:text-[42px] lg:text-[56px] leading-[116.02%] tracking-[-0.04em] text-[#373634]",
          "transition-all duration-1000 ease-out",
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        )}
        style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontWeight: 400 }}
      >
        Trusted by Thousands. <span style={{fontFamily: "'Montserrat', sans-serif", color: "#CF5B9D", fontStyle: "normal"}}> Loved Everywhere. </span>
      </h2>

      {/* Stats — 2-col grid on mobile/tablet, single divider-separated row on desktop */}
      <div className="grid w-full max-w-md grid-cols-2 gap-x-6 gap-y-9 sm:max-w-xl lg:flex lg:max-w-none lg:flex-row lg:items-center lg:justify-center lg:gap-0">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className={cn(
              "flex flex-row items-center justify-center transition-all duration-1000 ease-out lg:flex-1 lg:min-w-0",
              index === stats.length - 1 && "max-lg:col-span-2",
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            )}
            style={{ transitionDelay: `${index * 150}ms` }}
          >
            {/* Stat block */}
            <div className="flex flex-col items-center w-full">
              {/* Number */}
              <span
                className="w-full text-center text-[40px] min-[640px]:text-[48px] min-[1024px]:text-[36px] min-[1280px]:text-[44px] min-[1400px]:text-[56px] text-[#373634] -mt-0.5 lg:h-[90px]"
                style={{ fontFamily: "'Fraunces', serif", fontWeight: 300, fontStyle: "normal" }}
              >
                <CountUp 
                  end={stat.value} 
                  suffix={stat.suffix} 
                  start={isVisible} 
                  isDecimal={stat.isDecimal ?? false} 
                  duration={2500} 
                />
              </span>

              {/* Label */}
              <span
                className="w-full text-center text-[13px] min-[640px]:text-[15px] min-[1024px]:text-[13px] min-[1280px]:text-[15px] min-[1400px]:text-[16px] leading-[116.02%] tracking-[0.1em] uppercase text-[#A8698B]"
                style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}
              >
                {stat.label}
              </span>
            </div>

            {/* Divider — desktop row only, after every stat except the last */}
            {index < stats.length - 1 && (
              <div
                className="hidden lg:block w-px h-[109px] flex-shrink-0"
                style={{ background: "rgba(193, 121, 165, 0.4)" }}
              />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
