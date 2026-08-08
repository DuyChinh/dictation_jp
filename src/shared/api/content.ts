import { apiFetch } from "./client";
import type { LocalizedText } from "../content/getLocalizedText";

export type LocaleText = LocalizedText;

export type LessonSummary = {
  id: string;
  title: LocaleText;
  source: Record<string, unknown>;
  status: string;
  content_version: number;
  counts: {
    sections: number;
    questions: number;
    dictation_segments: number;
  };
};

export type LessonDetail = {
  id: string;
  title: LocaleText;
  source: Record<string, unknown>;
  status: string;
  content_version: number;
  audio_url: string;
  sections: Array<{
    id: string;
    order: number;
    title: LocaleText;
    question_count: number;
    dictation_segment_count: number;
  }>;
  counts: LessonSummary["counts"];
};

export type PracticeSegment = {
  id: string;
  order: number;
  speaker_id: string;
  start_ms?: number | null;
  end_ms?: number | null;
  text: LocaleText;
  timing_status: string;
  dictation_eligible?: boolean;
};

export type PracticeChoice = {
  id: string;
  text: LocaleText;
  image?: { url: string; alt?: LocaleText };
};

export type PracticeQuestion = {
  id: string;
  order: number;
  type: string;
  audio: { start_ms: number; end_ms: number };
  prompt?: LocaleText;
  choices?: PracticeChoice[];
  choice_display_mode?: "text" | "image";
  dialogue_translation?: LocaleText;
  segments: PracticeSegment[];
  dictation?: {
    enabled: boolean;
    modes?: {
      sentence_dictation?: { enabled: boolean; segment_ids?: string[] };
      full_question_dictation?: { enabled: boolean };
      fill_blank?: {
        enabled: boolean;
        items?: Array<{
          id?: string;
          segment_id: string;
          tokens: Array<{ text: string; hidden?: boolean }>;
        }>;
      };
    };
  };
};

export type PracticePackage = {
  id: string;
  title: LocaleText;
  source: Record<string, unknown>;
  audio_url: string;
  speakers: Array<{ id: string; label: LocaleText }>;
  sections: Array<{
    id: string;
    order: number;
    title: LocaleText;
    questions: PracticeQuestion[];
  }>;
};

export function listLessons() {
  return apiFetch<{ lessons: LessonSummary[] }>("/api/content/lessons");
}

export function getLesson(lessonId: string) {
  return apiFetch<{ lesson: LessonDetail }>(
    `/api/content/lessons/${encodeURIComponent(lessonId)}`,
  );
}

export function getPractice(lessonId: string, sectionId?: string) {
  const q = sectionId
    ? `?section_id=${encodeURIComponent(sectionId)}`
    : "";
  return apiFetch<{ practice: PracticePackage }>(
    `/api/content/lessons/${encodeURIComponent(lessonId)}/practice${q}`,
  );
}
