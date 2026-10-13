import type { CSSProperties, ReactNode } from "react";

export const ANIMALS = ["shiba", "neko", "kitsune", "usagi", "panda", "tanuki", "kuma", "fukurou"] as const;
export type Animal = (typeof ANIMALS)[number];

/** One face per animal on a 64x64 canvas, round background included. */
const FACES: Record<Animal, ReactNode> = {
  shiba: (
    <>
      <circle cx="32" cy="32" r="32" fill="#F6C177" />
      <polygon points="14,28 17,9 30,20" fill="#D9822B" />
      <polygon points="50,28 47,9 34,20" fill="#D9822B" />
      <ellipse cx="32" cy="37" rx="19" ry="17" fill="#E8963C" />
      <ellipse cx="32" cy="44" rx="12" ry="9" fill="#FFF4E0" />
      <circle cx="24.5" cy="34" r="2.2" fill="#2B1B10" />
      <circle cx="39.5" cy="34" r="2.2" fill="#2B1B10" />
      <ellipse cx="32" cy="40" rx="3" ry="2.1" fill="#2B1B10" />
      <path d="M28.5 45q3.5 3 7 0" fill="none" stroke="#2B1B10" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  neko: (
    <>
      <circle cx="32" cy="32" r="32" fill="#A8C7FA" />
      <polygon points="14,30 16,10 30,21" fill="#8C93A3" />
      <polygon points="50,30 48,10 34,21" fill="#8C93A3" />
      <polygon points="18,27 19,16 26,22" fill="#F3B6C4" />
      <polygon points="46,27 45,16 38,22" fill="#F3B6C4" />
      <ellipse cx="32" cy="38" rx="19" ry="16" fill="#8C93A3" />
      <path d="M28 24l1.5 5M36 24l-1.5 5M32 23v6" stroke="#6B7282" strokeWidth="2" strokeLinecap="round" />
      <circle cx="24.5" cy="37" r="2.4" fill="#1F2430" />
      <circle cx="39.5" cy="37" r="2.4" fill="#1F2430" />
      <polygon points="29.5,41.5 34.5,41.5 32,44.5" fill="#F3B6C4" />
      <path d="M12 40l9 1.5M12 45l9-1M52 40l-9 1.5M52 45l-9-1" stroke="#E9EDF5" strokeWidth="1.2" strokeLinecap="round" />
    </>
  ),
  kitsune: (
    <>
      <circle cx="32" cy="32" r="32" fill="#FFB4A2" />
      <path d="M13 26L17 8l12 11q3-1 6 0L47 8l4 18q0 15-19 29Q13 41 13 26z" fill="#E8662B" />
      <path d="M19 37q13-6 26 0-5 12-13 18-8-6-13-18z" fill="#FFF7F0" />
      <ellipse cx="24.5" cy="32.5" rx="2" ry="2.6" fill="#2B1B10" />
      <ellipse cx="39.5" cy="32.5" rx="2" ry="2.6" fill="#2B1B10" />
      <circle cx="32" cy="51" r="2.6" fill="#2B1B10" />
    </>
  ),
  usagi: (
    <>
      <circle cx="32" cy="32" r="32" fill="#D7C3F5" />
      <ellipse cx="23" cy="17" rx="5.5" ry="14" fill="#FFFFFF" />
      <ellipse cx="41" cy="17" rx="5.5" ry="14" fill="#FFFFFF" />
      <ellipse cx="23" cy="18" rx="2.6" ry="9.5" fill="#F6B8CB" />
      <ellipse cx="41" cy="18" rx="2.6" ry="9.5" fill="#F6B8CB" />
      <ellipse cx="32" cy="41" rx="17" ry="14.5" fill="#FFFFFF" />
      <circle cx="25.5" cy="39.5" r="2.2" fill="#3A2A55" />
      <circle cx="38.5" cy="39.5" r="2.2" fill="#3A2A55" />
      <ellipse cx="32" cy="44" rx="2.2" ry="1.6" fill="#F08FAE" />
      <circle cx="21" cy="45" r="3" fill="#F6B8CB" opacity="0.7" />
      <circle cx="43" cy="45" r="3" fill="#F6B8CB" opacity="0.7" />
    </>
  ),
  panda: (
    <>
      <circle cx="32" cy="32" r="32" fill="#B7E4C7" />
      <circle cx="17" cy="19" r="7.5" fill="#1F2430" />
      <circle cx="47" cy="19" r="7.5" fill="#1F2430" />
      <ellipse cx="32" cy="37" rx="19" ry="17" fill="#FFFFFF" />
      <ellipse cx="23.5" cy="35" rx="4.6" ry="6.4" fill="#1F2430" transform="rotate(-18 23.5 35)" />
      <ellipse cx="40.5" cy="35" rx="4.6" ry="6.4" fill="#1F2430" transform="rotate(18 40.5 35)" />
      <circle cx="24.5" cy="35" r="1.7" fill="#FFFFFF" />
      <circle cx="39.5" cy="35" r="1.7" fill="#FFFFFF" />
      <ellipse cx="32" cy="43" rx="3.2" ry="2.2" fill="#1F2430" />
    </>
  ),
  tanuki: (
    <>
      <circle cx="32" cy="32" r="32" fill="#E9D8A6" />
      <circle cx="16" cy="22" r="6.5" fill="#9A6A38" />
      <circle cx="48" cy="22" r="6.5" fill="#9A6A38" />
      <circle cx="16" cy="22" r="3" fill="#4A3320" />
      <circle cx="48" cy="22" r="3" fill="#4A3320" />
      <ellipse cx="32" cy="38" rx="19.5" ry="17" fill="#A9743F" />
      <ellipse cx="32" cy="44" rx="13" ry="9.5" fill="#F3DDB5" />
      <ellipse cx="23.5" cy="34" rx="5.6" ry="4" fill="#3B2A1A" transform="rotate(-16 23.5 34)" />
      <ellipse cx="40.5" cy="34" rx="5.6" ry="4" fill="#3B2A1A" transform="rotate(16 40.5 34)" />
      <circle cx="24" cy="34" r="1.6" fill="#FFFFFF" />
      <circle cx="40" cy="34" r="1.6" fill="#FFFFFF" />
      <ellipse cx="32" cy="42" rx="3" ry="2.2" fill="#3B2A1A" />
    </>
  ),
  kuma: (
    <>
      <circle cx="32" cy="32" r="32" fill="#A0E7E5" />
      <circle cx="17" cy="21" r="7" fill="#8B5E3C" />
      <circle cx="47" cy="21" r="7" fill="#8B5E3C" />
      <circle cx="17" cy="21" r="3.5" fill="#D9A47A" />
      <circle cx="47" cy="21" r="3.5" fill="#D9A47A" />
      <circle cx="32" cy="37" r="18" fill="#8B5E3C" />
      <ellipse cx="32" cy="43" rx="8.5" ry="6.8" fill="#E7C29A" />
      <circle cx="25" cy="34" r="2.2" fill="#21140B" />
      <circle cx="39" cy="34" r="2.2" fill="#21140B" />
      <ellipse cx="32" cy="40.5" rx="3.2" ry="2.2" fill="#21140B" />
    </>
  ),
  fukurou: (
    <>
      <circle cx="32" cy="32" r="32" fill="#FDE68A" />
      <polygon points="15,24 19,9 29,18" fill="#7A5A4E" />
      <polygon points="49,24 45,9 35,18" fill="#7A5A4E" />
      <ellipse cx="32" cy="38" rx="19" ry="19.5" fill="#8D6E63" />
      <ellipse cx="32" cy="50" rx="11" ry="7" fill="#D7B899" />
      <circle cx="24" cy="34" r="8.5" fill="#FFF8E7" />
      <circle cx="40" cy="34" r="8.5" fill="#FFF8E7" />
      <circle cx="24.5" cy="34.5" r="3.8" fill="#21140B" />
      <circle cx="39.5" cy="34.5" r="3.8" fill="#21140B" />
      <circle cx="25.8" cy="33" r="1.2" fill="#FFFFFF" />
      <circle cx="40.8" cy="33" r="1.2" fill="#FFFFFF" />
      <polygon points="29,40 35,40 32,47" fill="#F59E0B" />
    </>
  ),
};

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Each person always gets the same animal, picked from their name. */
export function animalFor(name: string): Animal {
  return ANIMALS[hash(name.trim().toLowerCase()) % ANIMALS.length]!;
}

export function AnimalAvatar({
  name,
  size = 40,
  className,
  style,
}: {
  name: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      style={{ borderRadius: "50%", flexShrink: 0, ...style }}
    >
      {FACES[animalFor(name)]}
    </svg>
  );
}
