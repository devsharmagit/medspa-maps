"use client";

import { Award, Headphones, Star } from "lucide-react";
import { useEffect, useState } from "react";

function CountdownTimer() {
  const [timeLeft, setTimeLeft] = useState({
    days: 2,
    hours: 14,
    minutes: 36,
    seconds: 28,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        let { days, hours, minutes, seconds } = prev;

        if (seconds > 0) {
          seconds--;
        } else if (minutes > 0) {
          minutes--;
          seconds = 59;
        } else if (hours > 0) {
          hours--;
          minutes = 59;
          seconds = 59;
        } else if (days > 0) {
          days--;
          hours = 23;
          minutes = 59;
          seconds = 59;
        }

        return { days, hours, minutes, seconds };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-4">
      <div className="flex flex-col items-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
          <span className="font-montserrat text-3xl font-bold text-white">
            {String(timeLeft.days).padStart(2, "0")}
          </span>
        </div>
        <span className="mt-1 font-montserrat text-xs text-white/80">Days</span>
      </div>
      <div className="flex flex-col items-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
          <span className="font-montserrat text-3xl font-bold text-white">
            {String(timeLeft.hours).padStart(2, "0")}
          </span>
        </div>
        <span className="mt-1 font-montserrat text-xs text-white/80">hours</span>
      </div>
      <div className="flex flex-col items-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
          <span className="font-montserrat text-3xl font-bold text-white">
            {String(timeLeft.minutes).padStart(2, "0")}
          </span>
        </div>
        <span className="mt-1 font-montserrat text-xs text-white/80">Min</span>
      </div>
      <div className="flex flex-col items-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
          <span className="font-montserrat text-3xl font-bold text-white">
            {String(timeLeft.seconds).padStart(2, "0")}
          </span>
        </div>
        <span className="mt-1 font-montserrat text-xs text-white/80">Sec</span>
      </div>
    </div>
  );
}

export function CTACards() {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    businessName: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Form submitted:", formData);
  };

  return (
    <div className="flex w-full max-w-[1372px] gap-6">
      {/* Left Card - Get Your medSpa Listed */}
      <div
        className="relative flex-1 overflow-hidden rounded-3xl p-12"
        style={{
          backgroundImage: "url(/images/landingpage/gift-bg-whole.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Content */}
        <div className="relative z-10 max-w-md">
          <h2 className="mb-2 font-montserrat text-[32px] font-normal leading-tight text-[#6B4A6B]">
            Get Your medSpa listed
          </h2>
          <h3 className="mb-4 font-heading text-[36px] italic leading-tight text-[#6B4A6B]">
            & Get More Clients!
          </h3>
          <p className="mb-8 font-montserrat text-base leading-relaxed text-[#6B4A6B]">
            List your clinic today and get a chance to be featured on our
            homepage!
          </p>

          {/* Benefits */}
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/40">
                <Award className="h-5 w-5 text-[#8B5A8B]" />
              </div>
              <div>
                <p className="font-montserrat text-base font-semibold text-[#6B4A6B]">
                  Free Premium Listing
                </p>
                <p className="font-montserrat text-sm text-[#8B6A8B]">
                  For first 100 signups
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/40">
                <Star className="h-5 w-5 text-[#8B5A8B]" />
              </div>
              <div>
                <p className="font-montserrat text-base font-semibold text-[#6B4A6B]">
                  Featured on Homepage
                </p>
                <p className="font-montserrat text-sm text-[#8B6A8B]">
                  Get maximum velocity
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/40">
                <Headphones className="h-5 w-5 text-[#8B5A8B]" />
              </div>
              <div>
                <p className="font-montserrat text-base font-semibold text-[#6B4A6B]">
                  Priority Support
                </p>
                <p className="font-montserrat text-sm text-[#8B6A8B]">
                  Dedicated account manager
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Card - Claim Your Benefits */}
      <div className="flex flex-1 flex-col items-center justify-center rounded-3xl bg-gradient-to-br from-[#F5F3F7] to-[#EBE7EF] p-12">
        <div className="w-full max-w-md">
          <h2 className="mb-2 text-center font-montserrat text-[32px] font-normal text-[#6B4A6B]">
            Claim Your Benefits
          </h2>
          <p className="mb-6 text-center font-montserrat text-sm text-[#8B6A8B]">
            Unlimited time offer!
          </p>

          {/* Countdown Timer */}
          <div className="mb-8 flex justify-center">
            <CountdownTimer />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              placeholder="Full Name"
              value={formData.fullName}
              onChange={(e) =>
                setFormData({ ...formData, fullName: e.target.value })
              }
              className="w-full rounded-lg border border-[#D4C4D8] bg-white px-4 py-3 font-montserrat text-sm text-[#6B4A6B] placeholder-[#B8A8B8] transition-colors focus:border-[#9B6FB5] focus:outline-none"
              required
            />
            <input
              type="email"
              placeholder="Business Email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              className="w-full rounded-lg border border-[#D4C4D8] bg-white px-4 py-3 font-montserrat text-sm text-[#6B4A6B] placeholder-[#B8A8B8] transition-colors focus:border-[#9B6FB5] focus:outline-none"
              required
            />
            <input
              type="text"
              placeholder="Business Name"
              value={formData.businessName}
              onChange={(e) =>
                setFormData({ ...formData, businessName: e.target.value })
              }
              className="w-full rounded-lg border border-[#D4C4D8] bg-white px-4 py-3 font-montserrat text-sm text-[#6B4A6B] placeholder-[#B8A8B8] transition-colors focus:border-[#9B6FB5] focus:outline-none"
              required
            />
            <button
              type="submit"
              className="w-full rounded-lg bg-gradient-to-r from-[#DE7F4C] to-[#C341D7] py-3 font-montserrat text-base font-semibold text-white transition-opacity hover:opacity-90"
            >
              Claim Your Benefits!
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
