const KEY = "jd.resume.v1";

export type ResumePointer = {
  lesson_id: string;
  mode: string;
  section_id?: string;
  question_id?: string;
  segment_id?: string;
};

export function loadResume(): ResumePointer | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ResumePointer) : null;
  } catch {
    return null;
  }
}

export function saveResume(pointer: ResumePointer): void {
  localStorage.setItem(KEY, JSON.stringify(pointer));
}
