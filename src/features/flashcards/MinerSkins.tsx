import type { ReactElement } from "react";
import type { SkinId } from "./miner";

/**
 * The look of each kind of haul: drawn wide (100 by 44) so a word fits on top, and stretched to the nugget's
 * box. Strokes keep their width when stretched.
 */
const STROKE = { vectorEffect: "non-scaling-stroke", strokeLinejoin: "round" } as const;

function Defs({ id, stops }: { id: string; stops: Array<[number, string]> }) {
  return (
    <defs>
      <radialGradient id={`fcg-${id}`} cx="32%" cy="24%" r="85%">
        {stops.map(([o, c]) => (
          <stop key={o} offset={o} stopColor={c} />
        ))}
      </radialGradient>
    </defs>
  );
}

const ART: Record<SkinId, ReactElement> = {
  gold: (
    <>
      <Defs id="gold" stops={[[0, "#fff7c2"], [0.4, "#fcd34d"], [0.8, "#f59e0b"], [1, "#d97706"]]} />
      <path d="M7 27C3 14 17 4 34 6C45 1 61 3 71 8C87 8 97 18 93 30C91 40 75 42 60 41C45 44 26 42 14 38C9 35 7 31 7 27Z" fill="url(#fcg-gold)" stroke="#b45309" strokeWidth="2" {...STROKE} />
      <path d="M17 15C25 8 38 8 47 10" stroke="#fffbe0" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.75" {...STROKE} />
      <path d="M60 33C69 37 82 35 89 27" stroke="#b45309" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.35" {...STROKE} />
    </>
  ),
  silver: (
    <>
      <Defs id="silver" stops={[[0, "#ffffff"], [0.4, "#e5e7eb"], [0.8, "#9ca3af"], [1, "#6b7280"]]} />
      <path d="M5 24C4 12 18 5 33 6C46 2 62 3 72 7C88 7 98 17 94 29C92 39 76 42 60 41C44 43 27 42 15 38C8 35 5 30 5 24Z" fill="url(#fcg-silver)" stroke="#4b5563" strokeWidth="2" {...STROKE} />
      <path d="M16 15C25 9 38 9 48 11" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.8" {...STROKE} />
      <path d="M58 34C68 38 82 36 90 28" stroke="#374151" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.3" {...STROKE} />
    </>
  ),
  emerald: (
    <>
      <Defs id="emerald" stops={[[0, "#d1fae5"], [0.35, "#34d399"], [0.8, "#059669"], [1, "#065f46"]]} />
      <path d="M20 3H80L97 15V29L80 41H20L3 29V15Z" fill="url(#fcg-emerald)" stroke="#064e3b" strokeWidth="2" {...STROKE} />
      <path d="M25 9H75L88 18V26L75 35H25L12 26V18Z" fill="none" stroke="#fff" strokeWidth="1.5" opacity="0.55" {...STROKE} />
      <path d="M20 3L25 9M80 3L75 9M97 15L88 18M97 29L88 26M80 41L75 35M20 41L25 35M3 15L12 18M3 29L12 26" stroke="#fff" strokeWidth="1.2" opacity="0.4" {...STROKE} />
    </>
  ),
  ruby: (
    <>
      <Defs id="ruby" stops={[[0, "#fecaca"], [0.35, "#f87171"], [0.75, "#dc2626"], [1, "#7f1d1d"]]} />
      <path d="M2 22C18 3 82 3 98 22C82 41 18 41 2 22Z" fill="url(#fcg-ruby)" stroke="#7f1d1d" strokeWidth="2" {...STROKE} />
      <path d="M2 22H98M26 8L40 22L26 36M74 8L60 22L74 36" stroke="#fff" strokeWidth="1.2" fill="none" opacity="0.4" {...STROKE} />
      <path d="M18 14C28 8 42 7 52 8" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.6" {...STROKE} />
    </>
  ),
  diamond: (
    <>
      <Defs id="diamond" stops={[[0, "#ffffff"], [0.35, "#bae6fd"], [0.75, "#38bdf8"], [1, "#0369a1"]]} />
      <path d="M22 4H78L98 17L50 42L2 17Z" fill="url(#fcg-diamond)" stroke="#075985" strokeWidth="2" {...STROKE} />
      <path d="M2 17H98M22 4L34 17L50 42L66 17L78 4M34 17L50 4L66 17" stroke="#fff" strokeWidth="1.3" fill="none" opacity="0.65" {...STROKE} />
    </>
  ),
  chest: (
    <>
      <defs>
        <linearGradient id="fcg-chest-lid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c2761c" />
          <stop offset="1" stopColor="#8a4a0f" />
        </linearGradient>
        <linearGradient id="fcg-chest-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#92400e" />
          <stop offset="1" stopColor="#4a2008" />
        </linearGradient>
      </defs>
      <path d="M5 20H95V39C95 41 93 42 91 42H9C7 42 5 41 5 39Z" fill="url(#fcg-chest-body)" stroke="#3b1a05" strokeWidth="2" {...STROKE} />
      <path d="M5 20C5 8 14 3 26 3H74C86 3 95 8 95 20Z" fill="url(#fcg-chest-lid)" stroke="#3b1a05" strokeWidth="2" {...STROKE} />
      <path d="M21 3V42M79 3V42" stroke="#fbbf24" strokeWidth="5" opacity="0.95" {...STROKE} />
      <rect x="43" y="15" width="14" height="13" rx="2" fill="#fcd34d" stroke="#92400e" strokeWidth="1.5" {...STROKE} />
      <circle cx="50" cy="21" r="2" fill="#78350f" />
    </>
  ),
};

/** The picture behind a nugget's word. */
export function SkinArt({ skin }: { skin: SkinId }) {
  return (
    <svg className="fc-miner__art" viewBox="0 0 100 44" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      {ART[skin]}
    </svg>
  );
}
