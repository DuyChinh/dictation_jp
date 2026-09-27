import { useId } from "react";
import type { UiLang } from "../i18n/translations";

/** Flag for a UI language, drawn inline so it looks the same on every OS (emoji flags don't on Windows). */
export function Flag({ lang, className }: { lang: UiLang; className?: string }) {
  const id = useId();
  const common = {
    className,
    width: 21,
    height: 14,
    viewBox: "0 0 30 20",
    preserveAspectRatio: "xMidYMid slice",
    "aria-hidden": true,
  } as const;

  if (lang === "vi") {
    return (
      <svg {...common}>
        <rect width="30" height="20" fill="#da251d" />
        <polygon
          fill="#ffff00"
          points="15,4 16.35,8.15 20.71,8.15 17.18,10.71 18.53,14.85 15,12.29 11.47,14.85 12.82,10.71 9.29,8.15 13.65,8.15"
        />
      </svg>
    );
  }

  if (lang === "ja") {
    return (
      <svg {...common}>
        <rect width="30" height="20" fill="#ffffff" />
        <circle cx="15" cy="10" r="6" fill="#bc002d" />
      </svg>
    );
  }

  // English: the Union Jack, matching the en-GB dates the app shows.
  return (
    <svg {...common} viewBox="0 0 60 30">
      <clipPath id={`${id}s`}>
        <path d="M0,0 v30 h60 v-30 z" />
      </clipPath>
      <clipPath id={`${id}t`}>
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <g clipPath={`url(#${id}s)`}>
        <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#ffffff" strokeWidth="6" />
        <path d="M0,0 L60,30 M60,0 L0,30" clipPath={`url(#${id}t)`} stroke="#c8102e" strokeWidth="4" />
        <path d="M30,0 v30 M0,15 h60" stroke="#ffffff" strokeWidth="10" />
        <path d="M30,0 v30 M0,15 h60" stroke="#c8102e" strokeWidth="6" />
      </g>
    </svg>
  );
}
