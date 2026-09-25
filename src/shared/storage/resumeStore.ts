export const RESUME_KEY = "jd.resume.v1";

export type ResumePointer = {
  lesson_id: string;
  mode: string;
  section_id?: string;
  question_id?: string;
  segment_id?: string;
};

export function loadResume(): ResumePointer | null {
  try {
    const raw = localStorage.getItem(RESUME_KEY);
    return raw ? (JSON.parse(raw) as ResumePointer) : null;
  } catch {
    return null;
  }
}

export function saveResume(pointer: ResumePointer): void {
  localStorage.setItem(RESUME_KEY, JSON.stringify(pointer));
}
