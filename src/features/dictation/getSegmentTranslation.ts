import type { PracticeQuestion, PracticeSegment } from "../../shared/api/content";

/**
 * Accurately extracts the translation for a given segment from either:
 * 1. Direct segment.text[lang]
 * 2. Or question.dialogue_translation[lang] mapped by turn and sentence position
 */
export function getSegmentTranslation(
  segment: PracticeSegment,
  question: PracticeQuestion,
  lang: string
): string {
  if (lang === "ja") return "";

  // 1. Direct segment text translation
  const segText = segment.text as Record<string, string | undefined>;
  if (segText?.[lang]) {
    return segText[lang]!;
  }

  // 2. Dialogue translation in question
  const dialogueObj = question.dialogue_translation as Record<string, string | undefined> | undefined;
  const fullTrans = dialogueObj?.[lang];
  if (!fullTrans || fullTrans === "—") return "";

  const lines = fullTrans.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return "";

  // Group all segments in question by turn
  const turnMap = new Map<string, PracticeSegment[]>();
  const turnOrder: string[] = [];

  question.segments.forEach((s) => {
    // Extract turn ID e.g. "t1" from "...-t1-s1" or "...-t1"
    const match = s.id.match(/-([a-zA-Z0-9]+)-s\d+$/) || s.id.match(/-(t\d+)/);
    const turnId = match ? match[1]! : s.speaker_id || s.id;
    if (!turnMap.has(turnId)) {
      turnMap.set(turnId, []);
      turnOrder.push(turnId);
    }
    turnMap.get(turnId)!.push(s);
  });

  // Find which turn this segment belongs to and its index inside the turn
  let targetTurnId = "";
  let segIdxInTurn = 0;
  for (const [tId, segs] of turnMap.entries()) {
    const idx = segs.findIndex((s) => s.id === segment.id);
    if (idx !== -1) {
      targetTurnId = tId;
      segIdxInTurn = idx;
      break;
    }
  }

  const turnIndex = turnOrder.indexOf(targetTurnId);
  if (turnIndex === -1 || !lines[turnIndex]) {
    // Fallback: if lines 1-to-1 with segments
    const segIdxInQ = question.segments.findIndex((s) => s.id === segment.id);
    if (segIdxInQ >= 0 && lines[segIdxInQ]) {
      return lines[segIdxInQ]!;
    }
    return lines[0] || "";
  }

  const turnLine = lines[turnIndex]!;
  const segsInThisTurn = turnMap.get(targetTurnId) || [];

  // If this turn has multiple sentence segments, extract the specific sentence
  if (segsInThisTurn.length > 1) {
    const speakerMatch = turnLine.match(/^([^:：]+[:：]\s*)(.*)$/);
    const speakerPrefix = speakerMatch ? speakerMatch[1]! : "";
    const content = speakerMatch ? speakerMatch[2]! : turnLine;

    const sentences = content.split(/(?<=[.?!。！？])\s+/).filter(Boolean);
    if (sentences.length === segsInThisTurn.length && sentences[segIdxInTurn]) {
      return speakerPrefix + sentences[segIdxInTurn]!.trim();
    }
  }

  return turnLine;
}
