import { furiganaSegments } from "../utils/furigana";

/**
 * A Japanese word with its reading written above the kanji only: 湧かす shows "わ" over 湧 and leaves かす bare.
 * A word without kanji, or without a usable reading, is plain text.
 */
export function Furigana({ word, reading }: { word: string; reading?: string | null }) {
  const segments = furiganaSegments(word, reading);
  if (!segments) return <>{word}</>;
  return (
    <>
      {segments.map((s, i) =>
        s.reading ? (
          <ruby key={i}>
            {s.text}
            <rp>(</rp>
            <rt>{s.reading}</rt>
            <rp>)</rp>
          </ruby>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}
