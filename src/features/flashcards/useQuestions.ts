import { useMemo, useRef } from "react";
import { createPicker, dropItemFor, type DropItem, type QuestionPicker } from "./quiz";
import { recordAnswer } from "./store";
import type { Card, Direction } from "./types";

/**
 * What a game asks, over the whole deck: every word once per round, the weak ones early, and a word answered wrong asked
 * again a few questions later until it is answered right. Answers also go into each card's learning box, so the words that
 * went wrong come first in the next game too.
 */
export function useQuestions(cards: Card[], direction: Direction) {
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const directionRef = useRef(direction);
  directionRef.current = direction;
  const picker = useRef<QuestionPicker | null>(null);
  return useMemo(
    () => ({
      /** The next question. */
      next(): DropItem {
        picker.current ??= createPicker(() => cardsRef.current);
        const card = picker.current.next();
        return dropItemFor(card, cardsRef.current, directionRef.current);
      },
      /** Tells how the question just asked was answered. */
      answered(cardId: string, correct: boolean): void {
        picker.current?.answered(cardId, correct);
        recordAnswer(cardId, correct);
      },
      /** A new game: start the rounds again. */
      reset(): void {
        picker.current = null;
      },
    }),
    [],
  );
}
