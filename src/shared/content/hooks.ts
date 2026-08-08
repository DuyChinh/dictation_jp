import { useEffect, useState } from "react";
import {
  getLesson,
  getPractice,
  listLessons,
  type LessonDetail,
  type LessonSummary,
  type PracticePackage,
} from "../api/content";

export function useLessons() {
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let c = false;
    listLessons()
      .then((d) => {
        if (!c) setLessons(d.lessons);
      })
      .catch((e) => {
        if (!c) setError(e instanceof Error ? e.message : "Error");
      })
      .finally(() => {
        if (!c) setLoading(false);
      });
    return () => {
      c = true;
    };
  }, []);

  return { lessons, error, loading };
}

export function useLesson(lessonId: string) {
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let c = false;
    setLoading(true);
    getLesson(lessonId)
      .then((d) => {
        if (!c) setLesson(d.lesson);
      })
      .catch((e) => {
        if (!c) setError(e instanceof Error ? e.message : "Error");
      })
      .finally(() => {
        if (!c) setLoading(false);
      });
    return () => {
      c = true;
    };
  }, [lessonId]);

  return { lesson, error, loading };
}

export function usePractice(lessonId: string, sectionId?: string) {
  const [practice, setPractice] = useState<PracticePackage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let c = false;
    setLoading(true);
    getPractice(lessonId, sectionId)
      .then((d) => {
        if (!c) setPractice(d.practice);
      })
      .catch((e) => {
        if (!c) setError(e instanceof Error ? e.message : "Error");
      })
      .finally(() => {
        if (!c) setLoading(false);
      });
    return () => {
      c = true;
    };
  }, [lessonId, sectionId]);

  return { practice, error, loading };
}
