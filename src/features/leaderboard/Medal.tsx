import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";

const TONES = {
  1: { disc: "#F4C542", ring: "#FFF1B0", edge: "#C9981A", text: "#6B4B00", ribbon: "#E5484D" },
  2: { disc: "#CFD6E3", ring: "#FFFFFF", edge: "#8E9AB0", text: "#2F3A4D", ribbon: "#4F8FF7" },
  3: { disc: "#E0A070", ring: "#FFDDBF", edge: "#A8683A", text: "#5E3210", ribbon: "#2DBF8A" },
} as const;

/** A gold, silver or bronze medal for 1st to 3rd place; `ribbon` adds the neck ribbon above the disc. */
export function Medal({ place, size = 44, ribbon = true }: { place: 1 | 2 | 3; size?: number; ribbon?: boolean }) {
  const { t } = useUiLanguage();
  const c = TONES[place];
  const h = ribbon ? (size * 56) / 48 : size;
  return (
    <svg
      className="lb-medal"
      width={size}
      height={h}
      viewBox={ribbon ? "0 0 48 56" : "0 12 48 44"}
      role="img"
      aria-label={`${t("lb.rankWord")} ${place}`}
    >
      {ribbon && (
        <>
          <polygon points="9,0 21,0 32,24 20,24" fill={c.ribbon} />
          <polygon points="39,0 27,0 16,24 28,24" fill={c.ribbon} opacity="0.82" />
        </>
      )}
      <circle cx="24" cy="36" r="18" fill={c.edge} />
      <circle cx="24" cy="36" r="16" fill={c.disc} />
      <circle cx="24" cy="36" r="12" fill="none" stroke={c.ring} strokeWidth="1.8" />
      <text
        x="24"
        y="36"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="18"
        fontWeight="800"
        fill={c.text}
        style={{ fontFamily: "inherit" }}
      >
        {place}
      </text>
    </svg>
  );
}

/** A small shield with the rank inside it, for 4th to 10th place. */
export function RankBadge({ rank, size = 32 }: { rank: number; size?: number }) {
  const { t } = useUiLanguage();
  return (
    <svg
      className="lb-badge"
      width={size}
      height={(size * 52) / 48}
      viewBox="0 0 48 52"
      role="img"
      aria-label={`${t("lb.rankWord")} ${rank}`}
    >
      <path className="lb-badge__shape" d="M24 3 42 9v15c0 12-9 20-18 25C15 44 6 36 6 24V9z" strokeWidth="2.4" strokeLinejoin="round" />
      <text
        className="lb-badge__text"
        x="24"
        y="25"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={rank >= 10 ? 17 : 21}
        fontWeight="800"
        style={{ fontFamily: "inherit" }}
      >
        {rank}
      </text>
    </svg>
  );
}
