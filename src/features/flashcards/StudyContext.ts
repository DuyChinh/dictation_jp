import { createContext, useContext } from "react";

/** Where "back to the deck" goes. A shared deck is studied away from the owner's own decks, so it says where. */
export const BackToContext = createContext<string | null>(null);

export const useBackTo = (deckId: string): string => useContext(BackToContext) ?? `/flashcards/${deckId}`;
