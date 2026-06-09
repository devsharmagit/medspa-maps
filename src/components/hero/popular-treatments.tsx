"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRef } from "react";

const treatments = [
  {
    name: "Fillers",
    clinics: 842,
    startingPrice: 199,
    icon: (
      <svg
        width="35"
        height="35"
        viewBox="0 0 35 35"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M29.9313 23.6266C29.9313 23.9531 30.1985 24.2203 30.525 24.2203H30.9644C31.2909 24.2203 31.5581 23.9531 31.5581 23.6266C31.5581 23.3 31.2909 23.0329 30.9644 23.0329H30.525C30.1985 23.0329 29.9313 23.3 29.9313 23.6266ZM22.5695 22.3501H23.0088C23.3354 22.3501 23.6025 22.6173 23.6025 22.9438C23.6025 23.2704 23.3354 23.5375 23.0088 23.5375H22.5695C22.243 23.5375 21.9758 23.2704 21.9758 22.9438C21.9758 22.6173 22.243 22.3501 22.5695 22.3501ZM19.1617 26.2092H19.601C19.9276 26.2092 20.1947 26.4763 20.1947 26.8028C20.1947 27.1294 19.9276 27.3965 19.601 27.3965H19.1617C18.8351 27.3965 18.568 27.1294 18.568 26.8028C18.568 26.4763 18.8351 26.2092 19.1617 26.2092ZM5.28699 22.5817H5.72632C6.05286 22.5817 6.32002 22.8488 6.32002 23.1754C6.32002 23.5019 6.05286 23.7691 5.72632 23.7691H5.28699C4.96046 23.7691 4.69329 23.5019 4.69329 23.1754C4.69329 22.8488 4.96046 22.5817 5.28699 22.5817ZM3.47028 26.506H3.90961C4.23615 26.506 4.50331 26.7732 4.50331 27.0997C4.50331 27.4262 4.23615 27.6934 3.90961 27.6934H3.47028C3.14374 27.6934 2.87658 27.4262 2.87658 27.0997C2.87658 26.7732 3.14374 26.506 3.47028 26.506ZM14.8039 23.4307H15.2433C15.5698 23.4307 15.837 23.6978 15.837 24.0243C15.837 24.3509 15.5698 24.618 15.2433 24.618H14.8039C14.4774 24.618 14.2103 24.3509 14.2103 24.0243C14.2103 23.6978 14.4774 23.4307 14.8039 23.4307ZM26.6957 25.5976H27.135C27.4616 25.5976 27.7287 25.8648 27.7287 26.1913C27.7287 26.5179 27.4616 26.785 27.135 26.785H26.6957C26.3692 26.785 26.102 26.5179 26.102 26.1913C26.102 25.8648 26.3692 25.5976 26.6957 25.5976ZM9.41912 25.3127H9.85845C10.185 25.3127 10.4522 25.5798 10.4522 25.9064C10.4522 26.2329 10.185 26.5001 9.85845 26.5001H9.41912C9.09258 26.5001 8.82542 26.2329 8.82542 25.9064C8.82542 25.5798 9.09258 25.3127 9.41912 25.3127ZM0.00308609 11.5033V32.4845C0.00308609 33.5769 0.893635 34.4615 1.9801 34.4615H32.4605C33.5529 34.4615 34.4375 33.571 34.4375 32.4845V11.5033C34.4375 10.4109 33.547 9.52627 32.4605 9.52627H23.6738V9.47284C23.6738 8.51699 22.896 7.73331 21.9342 7.73331H21.5721C21.5721 7.73331 21.5305 7.72737 21.5127 7.70956C21.4949 7.69175 21.489 7.67394 21.4949 7.65019L22.1717 0.668314C22.1866 0.511659 22.1387 0.355504 22.0385 0.234161C21.9383 0.112818 21.794 0.0362155 21.6374 0.0211847C21.5597 0.0132519 21.4813 0.0208255 21.4065 0.043466C21.3318 0.0661064 21.2623 0.103363 21.2021 0.153072C21.1419 0.202782 21.0922 0.263954 21.0558 0.333039C21.0195 0.402124 20.9972 0.477744 20.9903 0.555512L20.3135 7.52551C20.2719 7.86986 20.3847 8.23201 20.6281 8.49918C20.8656 8.76634 21.2099 8.9207 21.5721 8.9207H21.9342C22.237 8.9207 22.4864 9.17005 22.4864 9.47284V10.12C22.4864 10.1675 22.4508 10.2031 22.4033 10.2031H12.0433C11.9958 10.2031 11.9601 10.1675 11.9601 10.12V9.47284C11.9601 9.17005 12.2095 8.9207 12.5123 8.9207H12.8744C13.2366 8.9207 13.5809 8.76634 13.8184 8.49918C14.0559 8.23201 14.1687 7.86986 14.1271 7.51364L13.4503 0.555512C13.4452 0.476171 13.4242 0.398665 13.3886 0.327593C13.3529 0.256521 13.3034 0.19333 13.2429 0.14177C13.1823 0.0902103 13.1121 0.0513312 13.0363 0.0274397C12.9604 0.00354827 12.8806 -0.0048689 12.8014 0.00268772C12.7223 0.0102443 12.6455 0.0336208 12.5755 0.0714301C12.5056 0.109239 12.4439 0.160711 12.3943 0.222792C12.3446 0.284873 12.3079 0.356298 12.2864 0.432829C12.2648 0.50936 12.2589 0.589439 12.2689 0.668314L12.9457 7.63832C12.9457 7.67394 12.9457 7.69175 12.9279 7.70956C12.9101 7.72737 12.8922 7.73331 12.8685 7.73331H12.5063C11.5505 7.73331 10.7668 8.51105 10.7668 9.47284V9.52627H1.9801C0.887695 9.52627 0.00308609 10.4109 0.00308609 11.5033ZM21.0853 16.33V15.4573H33.2501V19.0789C33.1076 19.1442 32.9711 19.2095 32.8405 19.2866C31.9202 19.8269 30.7981 19.8328 29.8957 19.3104C29.2678 18.9491 28.5555 18.7599 27.831 18.762C27.1065 18.764 26.3954 18.9573 25.7695 19.3223C24.8493 19.8625 23.7331 19.8685 22.8307 19.346C22.2038 18.9842 21.4921 18.7951 20.7682 18.7983C20.0443 18.8014 19.3343 18.9966 18.7105 19.3638C17.7902 19.9041 16.6682 19.91 15.7657 19.3876C15.1378 19.0262 14.4255 18.8371 13.701 18.8391C12.9765 18.8412 12.2654 19.0345 11.6395 19.3995C11.1959 19.6639 10.6898 19.8055 10.1734 19.8097C9.65688 19.8139 9.1486 19.6805 8.70075 19.4232C8.07333 19.0628 7.36179 18.8746 6.63822 18.8777C5.91465 18.8808 5.20476 19.0752 4.58049 19.441C3.66026 19.9813 2.53817 19.9872 1.63575 19.4707C1.49327 19.3876 1.34484 19.3163 1.19641 19.251V15.4573H13.3613V16.33C13.3613 16.6566 13.6284 16.9237 13.955 16.9237C14.2815 16.9237 14.5487 16.6566 14.5487 16.33V15.4573H15.5461V16.33C15.5461 16.6566 15.8132 16.9237 16.1398 16.9237C16.4663 16.9237 16.7335 16.6566 16.7335 16.33V15.4573H17.7309V16.33C17.7309 16.6566 17.998 16.9237 18.3246 16.9237C18.6511 16.9237 18.9183 16.6566 18.9183 16.33V15.4573H19.9157V16.33C19.9157 16.6566 20.1828 16.9237 20.5094 16.9237C20.8359 16.9237 21.1031 16.6566 21.1031 16.33H21.0853ZM21.2277 12.0495C21.2277 12.2632 21.0556 12.4354 20.8418 12.4354H13.5928C13.3791 12.4354 13.2069 12.2632 13.2069 12.0495V11.3905H21.2218V12.0495H21.2277ZM17.719 13.6168V14.2699H16.7216V13.6168H17.719ZM15.5342 14.2758H14.5368V13.6228H15.5342V14.2758ZM19.8979 14.2758H18.9005V13.6228H19.8979V14.2758ZM33.2501 29.1183H1.19048V20.5809C1.78418 20.8896 2.43131 21.0499 3.07844 21.0499C3.79681 21.0499 4.51518 20.8599 5.15044 20.4859C5.59462 20.2205 6.10136 20.0778 6.61879 20.0726C7.13622 20.0674 7.64573 20.1998 8.09517 20.4562C8.72259 20.8167 9.43413 21.0049 10.1577 21.0017C10.8813 20.9986 11.5912 20.8043 12.2154 20.4384C13.1357 19.8982 14.2577 19.8922 15.1602 20.4206C15.7881 20.7819 16.5004 20.9711 17.2249 20.969C17.9494 20.967 18.6605 20.7737 19.2864 20.4087C19.73 20.1442 20.2361 20.0026 20.7525 19.9985C21.269 19.9943 21.7773 20.1277 22.2252 20.385C22.8526 20.7454 23.5641 20.9336 24.2877 20.9305C25.0113 20.9274 25.7211 20.733 26.3454 20.3672C27.2656 19.8269 28.3877 19.821 29.2901 20.3434C29.8894 20.6887 30.5665 20.8763 31.258 20.8888C31.9495 20.9013 32.6328 20.7381 33.2442 20.4147V29.1123L33.2501 29.1183ZM12.0254 11.3845V12.0435C12.0254 12.8272 12.6013 13.4744 13.3553 13.5931V14.2758H1.19048V11.5033C1.19048 11.0699 1.5467 10.7137 1.9801 10.7137H10.9212C11.1349 11.1114 11.5446 11.3845 12.0195 11.3905L12.0254 11.3845ZM33.2501 11.5033V14.2758H21.0853V13.5931C21.4548 13.5346 21.7914 13.3467 22.035 13.0628C22.2787 12.7789 22.4134 12.4176 22.4151 12.0435V11.3845C22.6424 11.382 22.8647 11.3176 23.0581 11.1984C23.2516 11.0792 23.409 10.9096 23.5135 10.7077H32.4605C32.8939 10.7077 33.2501 11.0639 33.2501 11.4973V11.5033ZM1.19048 32.4786V30.2997H33.2501V32.4786C33.2501 32.912 32.8939 33.2682 32.4605 33.2682H1.9801C1.5467 33.2682 1.19048 32.912 1.19048 32.4786Z"
          fill="url(#paint0_linear_14261_5098)"
        />
        <defs>
          <linearGradient
            id="paint0_linear_14261_5098"
            x1="17.2203"
            y1="0"
            x2="17.2203"
            y2="34.4615"
            gradientUnits="userSpaceOnUse"
          >
            <stop stop-color="#E0CAC3" />
            <stop offset="1" stop-color="#CB95AE" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
  {
    name: "Botox",
    clinics: 1254,
    startingPrice: 122,
    icon: (
      <svg
        width="35"
        height="35"
        viewBox="0 0 35 35"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g clip-path="url(#clip0_14261_5089)">
          <path
            d="M22.9132 13.4322L16.0923 20.2531M16.0923 20.2531L22.5239 24.0117C22.6525 24.0869 22.8024 24.1174 22.9502 24.0983C23.0979 24.0792 23.2352 24.0118 23.3406 23.9064L26.5666 20.6804C26.6719 20.575 26.7394 20.4378 26.7585 20.29C26.7775 20.1423 26.7471 19.9924 26.6719 19.8638L22.9132 13.4322L16.7292 7.24819C15.5496 6.06861 13.6371 6.06861 12.4575 7.24819L9.90827 9.7974C8.72869 10.977 8.72869 12.8895 9.90827 14.0691L16.0923 20.2531ZM15.8845 8.95172L17.1586 7.67752M10.3377 14.4984L11.6111 13.2251M25.9068 21.3403L27.3365 22.77C27.5997 23.0332 27.5997 23.46 27.3365 23.7231L26.3834 24.6762C26.1201 24.9394 25.6934 24.9394 25.4302 24.6762L24.0005 23.2465M17.3787 14.7185L19.3775 16.7173M27.0374 31.1244C28.019 30.9718 29.8935 30.4741 31.5136 28.854C31.5368 28.8308 31.5601 28.8071 31.5832 28.7835C32.7467 27.5914 33.5284 26.0263 33.7846 24.3767M26.6233 28.4605C27.0787 28.3896 28.4698 28.1139 29.6539 26.9006C30.7821 25.7445 31.0485 24.4276 31.1207 23.9631M11.0239 8.36365L6.54389 3.88365C6.37056 3.71031 6.16478 3.57281 5.93831 3.479C5.71183 3.38519 5.4691 3.33691 5.22397 3.33691C4.19302 3.33691 3.35731 4.17262 3.35731 5.20357V12.7139C3.35731 14.197 2.155 15.3993 0.671875 15.3993"
            stroke="url(#paint0_linear_14261_5089)"
            stroke-width="1.29231"
            stroke-miterlimit="10"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </g>
        <defs>
          <linearGradient
            id="paint0_linear_14261_5089"
            x1="17.2282"
            y1="3.33691"
            x2="17.2282"
            y2="31.1244"
            gradientUnits="userSpaceOnUse"
          >
            <stop stop-color="#CA94AD" />
            <stop offset="1" stop-color="#E0CAC3" />
          </linearGradient>
          <clipPath id="clip0_14261_5089">
            <rect width="34.4615" height="34.4615" fill="white" />
          </clipPath>
        </defs>
      </svg>
    ),
  },
  {
    name: "Laser",
    clinics: 536,
    startingPrice: 99,
    icon: (
      <svg
        width="35"
        height="35"
        viewBox="0 0 35 35"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M17.5 7L23 17.5L17.5 28L12 17.5L17.5 7Z"
          fill="url(#gradient3)"
        />
        <defs>
          <linearGradient
            id="gradient3"
            x1="17.5"
            y1="7"
            x2="17.5"
            y2="28"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#E1CBC4" />
            <stop offset="1" stopColor="#C78DAA" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
  {
    name: "Microneedling",
    clinics: 368,
    startingPrice: 299,
    icon: (
      <svg
        width="34"
        height="35"
        viewBox="0 0 34 35"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="17" cy="17.5" r="10" fill="url(#gradient4)" />
        <defs>
          <linearGradient
            id="gradient4"
            x1="17"
            y1="7.5"
            x2="17"
            y2="27.5"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#E0CAC3" />
            <stop offset="1" stopColor="#CB95AE" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
  {
    name: "Chemical Peel",
    clinics: 788,
    startingPrice: 69,
    icon: (
      <svg
        width="28"
        height="35"
        viewBox="0 0 28 35"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M14 7.5C10.5 7.5 7.5 10.5 7.5 14C7.5 17.5 10.5 20.5 14 20.5C17.5 20.5 20.5 17.5 20.5 14C20.5 10.5 17.5 7.5 14 7.5Z"
          fill="url(#gradient5)"
        />
        <defs>
          <linearGradient
            id="gradient5"
            x1="14"
            y1="7.5"
            x2="14"
            y2="20.5"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#E0C9C3" />
            <stop offset="1" stopColor="#CC96AF" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
  {
    name: "Skin Resurfacing",
    clinics: 218,
    startingPrice: 299,
    icon: (
      <svg
        width="30"
        height="35"
        viewBox="0 0 30 35"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M15 8L12 12L15 16L18 12L15 8Z" fill="url(#gradient6)" />
        <path d="M18 14L15 18L12 14L15 10L18 14Z" fill="url(#gradient6)" />
        <path d="M12 18L9 22L12 26L15 22L12 18Z" fill="url(#gradient6)" />
        <path d="M18 18L15 22L12 18L15 14L18 18Z" fill="url(#gradient6)" />
        <defs>
          <linearGradient
            id="gradient6"
            x1="15"
            y1="8"
            x2="15"
            y2="26"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#DDC3C0" />
            <stop offset="1" stopColor="#CD98B0" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
  {
    name: "IV Therapy",
    clinics: 524,
    startingPrice: 89,
    icon: (
      <svg
        width="40"
        height="40"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M20 8L24 16L20 24L16 16L20 8ZM20 16L24 24L20 32L16 24L20 16Z"
          fill="url(#gradient7)"
        />
        <defs>
          <linearGradient
            id="gradient7"
            x1="20"
            y1="8"
            x2="20"
            y2="32"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#DDC2C0" />
            <stop offset="1" stopColor="#CD99B0" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
  {
    name: "Body Counting",
    clinics: 189,
    startingPrice: 199,
    icon: (
      <svg
        width="48"
        height="48"
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M24 8C16 8 10 14 10 22C10 30 16 36 24 36C32 36 38 30 38 22C38 14 32 8 24 8Z"
          fill="url(#gradient8)"
        />
        <defs>
          <linearGradient
            id="gradient8"
            x1="24"
            y1="8"
            x2="24"
            y2="36"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#E1CBC4" />
            <stop offset="1" stopColor="#CE9DB1" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
];

function TreatmentCard({
  name,
  clinics,
  startingPrice,
  icon,
}: {
  name: string;
  clinics: number;
  startingPrice: number;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="
        box-border
        border
        flex
        h-[201px]
        w-[161px]!
        flex-col
        items-center
        justify-center
        gap-2
        rounded-2xl
        bg-white
        px-[10px]
        pt-[3px]
        shadow-[0px_6px_10.5px_1px_rgba(0,0,0,0.05)]
      "
    >
      {/* Icon Box */}
      <div
        className="
          flex
          h-[62px]
          w-[66px]
          items-center
          justify-center
          rounded-[10px]
          border
          border-[#F5DEE8]
          bg-[linear-gradient(144.23deg,#F5F0F7_-33.1%,#FFFFFF_48.72%)]
        "
      >
        {icon}
      </div>

      {/* Title */}
      <div
        className="
          flex
          h-[30px]
          w-[124px]
          items-center
          justify-center
          text-center
          font-montserrat
          text-[16px]
          font-medium
          leading-[116.02%]
          text-[#383838]
        "
      >
        {name}
      </div>

      {/* Clinics */}
      <div
        className="
          flex
          h-4
          items-center
          justify-center
          text-center
          font-inter
          text-[12px]
          font-normal
          leading-[100%]
          text-[#9A9A9A]
        "
      >
        {clinics} clinics
      </div>

      {/* Divider */}
      <div className="w-[105px] border-t border-[rgba(245,222,232,0.5)]" />

      {/* Price */}
      <div
        className="
          flex
          h-4
          items-end
          justify-center
          text-center
          font-inter
          text-[12px]
          font-normal
          leading-[100%]
          text-[#9A9A9A]
        "
      >
        Starting from ${startingPrice}
      </div>
    </div>
  );
}

export function PopularTreatments() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 340; // Width of card + gap
      const newScrollLeft =
        scrollContainerRef.current.scrollLeft +
        (direction === "left" ? -scrollAmount : scrollAmount);
      scrollContainerRef.current.scrollTo({
        left: newScrollLeft,
        behavior: "smooth",
      });
    }
  };

  return (
    <section className="flex w-full flex-col items-center py-16">
      {/* Section Header with Decorative Lines */}
      <div className="mb-[38px] flex h-[39px] w-full max-w-[1342px] items-center gap-[7px] px-4">
        {/* Left Line */}
        <div className="h-0 flex-1 border-t border-[rgba(193,121,165,0.4)]" />

        {/* Title */}
        <h2 className="w-auto whitespace-nowrap text-center font-montserrat text-[34px] font-normal leading-[116.02%] tracking-[-0.04em] text-[#373634]">
          Popular <span className="font-heading italic">Treatments</span>
        </h2>

        {/* Right Line */}
        <div className="h-0 flex-1 border-t border-[rgba(193,121,165,0.4)]" />
      </div>

      {/* Treatment Cards Container */}
      <div className="relative w-full max-w-[1342px] overflow-visible">
        <button
          onClick={() => scroll("left")}
          aria-label="Previous treatments"
          className="nav-arrow-btn nav-arrow-btn-left"
        >
          <ArrowLeft />
        </button>

        <div
          ref={scrollContainerRef}
          className="flex gap-2 overflow-x-auto px-12 scrollbar-none sm:px-14"
        >
          {treatments.map((treatment) => (
            <TreatmentCard key={treatment.name} {...treatment} />
          ))}
        </div>

        <button
          onClick={() => scroll("right")}
          aria-label="Next treatments"
          className="nav-arrow-btn nav-arrow-btn-right"
        >
          <ArrowRight />
        </button>
      </div>
    </section>
  );
}
