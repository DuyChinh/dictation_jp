import { apiFetch } from "./client";
import type { LocalizedText } from "../content/getLocalizedText";

export type DiffOp =
  | { type: "equal"; text: string }
  | { type: "insert"; text: string }
  | { type: "delete"; text: string }
  | { type: "replace"; expected: string; actual: string };

export type DictationEvalResult = {
  score: number;
  correct: boolean;
  algorithm_version: string;
  normalization_version: string;
  normalized_answer: string;
  normalized_expected: string;
  matched_accepted: boolean;
  ops: DiffOp[];
  revealed: {
    expected_text: { ja: string; vi: string };
    accepted_matched: boolean;
  } | null;
};

export type ListeningEvalResult = {
  correct: boolean;
  selected_choice_id: string;
  correct_choice_id: string | null;
  choices: Array<{
    id: string;
    correct: boolean;
    text: LocalizedText;
    explanation?: LocalizedText;
    evidence_segment_ids?: string[];
    image?: { url: string; alt?: LocalizedText };
  }>;
  evidence_segments: Array<{
    id: string;
    start_ms?: number | null;
    end_ms?: number | null;
    speaker_id: string;
    text: LocalizedText;
  }>;
  segments: Array<{
    id: string;
    order: number;
    speaker_id: string;
    start_ms?: number | null;
    end_ms?: number | null;
    text: LocalizedText;
  }>;
  prompt?: LocalizedText;
};

export function evaluateDictation(body: {
  lesson_id: string;
  question_id: string;
  segment_id?: string;
  mode: "sentence_dictation" | "full_question_dictation" | "fill_blank";
  answer: { raw: string };
  force_reveal?: boolean;
  behavior?: {
    replay_count?: number;
    hint_count?: number;
    attempt_index?: number;
  };
}) {
  return apiFetch<{ result: DictationEvalResult }>("/api/evaluate/dictation", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function evaluateListening(body: {
  lesson_id: string;
  question_id: string;
  answer: { choice_id: string };
  behavior?: { replay_count?: number; hint_count?: number };
}) {
  return apiFetch<{ result: ListeningEvalResult }>("/api/evaluate/listening", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
