import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../shared/ui/AppShell";
import { Icon } from "../shared/ui/Icon";
import { useUiLanguage } from "../shared/i18n/UiLanguageContext";
import type { UiLang } from "../shared/i18n/translations";
import { getAllDictationProgress, syncProgressOverviewFromServer } from "../shared/storage/dictationProgressStore";
import { getAllListeningAnswers } from "../shared/storage/listeningScoreStore";
import { getLessonActivity } from "../shared/storage/lessonActivityStore";
import { getExamHistory } from "../shared/storage/paperExamStore";
import { getPaperProgress } from "../shared/storage/paperProgressStore";
import { sortLessons } from "../features/lessons/lessonSearch";
import { fmt } from "../shared/i18n/format";
import {
  getUserStats,
  getPracticeHistory,
  syncHistoryFromServer,
  type UserOverallStats,
  type PracticeSessionItem,
} from "../shared/storage/practiceHistoryStore";
import { useLessonList } from "../features/lessons/LessonGrid";
import { lessonShortTitle } from "../shared/content/lessonLabels";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dayLabel(ts: number, lang: UiLang): string {
  return new Date(ts).toLocaleDateString(lang === "ja" ? "ja-JP" : lang === "en" ? "en-GB" : "vi-VN", {
    day: "2-digit",
    month: "2-digit",
  });
}

type Badge = { id: string; name: Record<UiLang, string>; desc: Record<UiLang, string>; unlocked: boolean };

type Totals = { correct: number; attempts: number; bestStreak: number };

function badgesFor(stats: Totals, accuracy: number): Badge[] {
  return [
    {
      id: "first_step",
      name: { vi: "Khởi đầu", ja: "最初の一歩", en: "First step" },
      desc: { vi: "Hoàn thành câu chép chính tả đầu tiên", ja: "ディクテーションを1問解く", en: "Complete your first sentence" },
      unlocked: stats.attempts >= 1,
    },
    {
      id: "streak_5",
      name: { vi: "Chuỗi 5 câu", ja: "5問連続正解", en: "5 in a row" },
      desc: { vi: "Đúng 5 câu liên tiếp", ja: "5問連続で正解", en: "Get 5 sentences right in a row" },
      unlocked: stats.bestStreak >= 5,
    },
    {
      id: "streak_10",
      name: { vi: "Chuỗi 10 câu", ja: "10問連続正解", en: "10 in a row" },
      desc: { vi: "Đúng 10 câu liên tiếp", ja: "10問連続で正解", en: "Get 10 sentences right in a row" },
      unlocked: stats.bestStreak >= 10,
    },
    {
      id: "streak_15",
      name: { vi: "Chuỗi 15 câu", ja: "15問連続正解", en: "15 in a row" },
      desc: { vi: "Đúng 15 câu liên tiếp", ja: "15問連続で正解", en: "Get 15 sentences right in a row" },
      unlocked: stats.bestStreak >= 15,
    },
    {
      id: "hard_worker",
      name: { vi: "Bền bỉ", ja: "継続は力なり", en: "Persistent" },
      desc: { vi: "Chép đúng từ 20 câu trở lên", ja: "20問以上正解", en: "Get 20 or more sentences right" },
      unlocked: stats.correct >= 20,
    },
    {
      id: "perfectionist",
      name: { vi: "Chính xác cao", ja: "高い正答率", en: "Sharp ears" },
      desc: { vi: "Độ chính xác ≥ 90% sau ít nhất 10 lượt", ja: "10回以上で正答率90%以上", en: "90%+ accuracy over 10+ checks" },
      unlocked: accuracy >= 90 && stats.attempts >= 10,
    },
  ];
}

export function HistoryPage() {
  const { t, uiLang } = useUiLanguage();
  const [stats, setStats] = useState<UserOverallStats>(() => getUserStats());
  const [history, setHistory] = useState<PracticeSessionItem[]>(() => getPracticeHistory());
  const { lessons } = useLessonList();

  // Bumped once the account's data is merged in, so the figures below are read again.
  const [synced, setSynced] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([syncHistoryFromServer(), syncProgressOverviewFromServer()]).then(([res]) => {
      if (cancelled) return;
      setStats(res.stats);
      setHistory(res.history);
      setSynced((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const progress = useMemo(() => getAllDictationProgress(), [synced]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const listening = useMemo(() => getAllListeningAnswers(), [synced]);

  /** Figures from the saved answers themselves, so every device and the server agree. */
  const totals = useMemo(() => {
    let correct = 0;
    let attempts = 0;
    const practiced = new Set<string>();
    for (const [lessonId, segments] of Object.entries(progress)) {
      for (const seg of Object.values(segments)) {
        if (seg.status !== "correct" && seg.status !== "incorrect") continue;
        attempts += seg.attempts || 1;
        if (seg.status === "correct") correct += 1;
        practiced.add(lessonId);
      }
    }
    for (const [lessonId, answers] of Object.entries(listening)) {
      if (Object.keys(answers).length > 0) practiced.add(lessonId);
    }
    return { correct, attempts, practiced: practiced.size, bestStreak: stats.bestStreak };
  }, [progress, listening, stats.bestStreak]);

  const accuracy = totals.attempts > 0 ? Math.round((totals.correct / totals.attempts) * 100) : 0;

  /** Correct sentences per day over the last 30 days (by the day each was last answered). */
  const days = useMemo(() => {
    const today = startOfDay(Date.now());
    const buckets = Array.from({ length: 30 }, (_, i) => ({ ts: today - (29 - i) * DAY_MS, count: 0 }));
    for (const lesson of Object.values(progress)) {
      for (const seg of Object.values(lesson)) {
        if (seg.status !== "correct" || !seg.updatedAt) continue;
        const idx = 29 - Math.round((today - startOfDay(seg.updatedAt)) / DAY_MS);
        if (idx >= 0 && idx < 30) buckets[idx]!.count += 1;
      }
    }
    return buckets;
  }, [progress]);
  const maxDay = Math.max(1, ...days.map((d) => d.count));

  /** Every lesson with any practice, most recently practised first. */
  const byLesson = useMemo(
    () =>
      sortLessons(lessons, getLessonActivity())
        .map((l) => {
          const segs = Object.values(progress[l.id] ?? {});
          const done = segs.filter((p) => p.status === "correct").length;
          const review = segs.filter((p) => p.status === "incorrect").length;
          const answers = Object.values(listening[l.id] ?? {});
          const right = answers.filter((a) => a.correct).length;
          const total = l.counts.dictation_segments || 1;
          const written = Object.keys(getPaperProgress(l.id).answers).length;
          return {
            written,
            id: l.id,
            label: lessonShortTitle(l.source, l.id),
            done,
            total,
            review,
            answered: answers.length,
            right,
            pct: Math.min(100, Math.round((done / total) * 100)),
          };
        })
        .filter((l) => l.done > 0 || l.review > 0 || l.answered > 0 || l.written > 0),
    [lessons, progress, listening],
  );

  /** One row per test per day: history stores an entry for every correct answer. */
  const sessions = useMemo(() => {
    const seen = new Set<string>();
    const rows: PracticeSessionItem[] = [];
    for (const item of history) {
      const key = `${item.lessonId}:${startOfDay(item.timestamp)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(item);
    }
    return rows.slice(0, 10);
  }, [history]);

  const lessonName = (id: string, fallback: string) => {
    const l = lessons.find((x) => x.id === id);
    return l ? lessonShortTitle(l.source, fallback) : fallback || id;
  };

  const examHistory = useMemo(() => getExamHistory(), []);
  const badges = badgesFor(totals, accuracy);
  const kpis = [
    { label: t("history.kpiCorrect"), value: String(totals.correct), note: `${totals.attempts} ${t("history.kpiAttempts")}` },
    { label: t("history.kpiAccuracy"), value: `${accuracy}%`, note: t("history.kpiAccuracyNote") },
    { label: t("history.kpiStreak"), value: String(stats.bestStreak), note: `${t("history.kpiStreakNow")}: ${stats.currentStreak}` },
    { label: t("history.kpiLessons"), value: String(totals.practiced), note: t("history.kpiLessonsNote") },
  ];

  return (
    <AppShell title={t("history.title")}>
      <div className="page-head">
        <div>
          <h1>{t("history.title")}</h1>
          <p>{t("history.sub")}</p>
        </div>
      </div>

      <section className="kpi-grid" aria-label={t("history.title")}>
        {kpis.map((k) => (
          <div key={k.label} className="panel kpi">
            <span className="kpi__label">{k.label}</span>
            <span className="kpi__value">{k.value}</span>
            <span className="kpi__note">{k.note}</span>
          </div>
        ))}
      </section>

      <div className="split-2">
        <section className="panel card-pad">
          <div className="card-pad__head">
            <h2>{t("history.daily")}</h2>
            <span>{t("history.last30")}</span>
          </div>
          <div className="bars" role="img" aria-label={`${t("history.daily")}, ${t("history.last30")}`}>
            {days.map((d, i) => (
              <span
                key={d.ts}
                title={`${dayLabel(d.ts, uiLang)}: ${d.count}`}
                className={d.count === 0 ? "is-zero" : i === days.length - 1 ? "is-today" : undefined}
                style={{ height: `${d.count === 0 ? 3 : Math.max(6, Math.round((d.count / maxDay) * 190))}px` }}
              />
            ))}
          </div>
          <div className="bars-axis">
            <span>{dayLabel(days[0]!.ts, uiLang)}</span>
            <span>{dayLabel(days[14]!.ts, uiLang)}</span>
            <span>{dayLabel(days[29]!.ts, uiLang)}</span>
          </div>
        </section>

        <section className="panel card-pad">
          <h2>{t("history.byLesson")}</h2>
          {byLesson.length === 0 ? (
            <span className="muted" style={{ fontSize: 14 }}>
              {t("history.noData")}
            </span>
          ) : (
            byLesson.map((l) => (
              <div key={l.id} className="meter">
                <div className="meter__label">
                  <Link to={`/lessons/${encodeURIComponent(l.id)}`}>{l.label}</Link>
                  <span>{l.pct}%</span>
                </div>
                <div className="progress">
                  <span style={{ width: `${l.pct}%` }} />
                </div>
                <div className="meter__sub">
                  <span>
                    {t("lesson.dictationTitle")} {l.done}/{l.total}
                  </span>
                  {l.written > 0 && (
                    <span>
                      {t("history.written")} {l.written}
                    </span>
                  )}
                  {l.answered > 0 && (
                    <span>
                      {t("listening.title")} {fmt(t("history.listeningRight"), { right: l.right, answered: l.answered })}
                    </span>
                  )}
                  {l.review > 0 && (
                    <Link to={`/lessons/${encodeURIComponent(l.id)}/dictation`} className="meter__review">
                      {fmt(t("history.toReview"), { n: l.review })}
                    </Link>
                  )}
                </div>
              </div>
            ))
          )}
        </section>
      </div>

      <section className="panel card-pad" style={{ marginBottom: 16 }}>
        <div className="card-pad__head">
          <h2>{t("history.exams")}</h2>
          <span>{t("history.examsSub")}</span>
        </div>
        {examHistory.length === 0 ? (
          <div className="empty empty--inline">
            <p>{t("history.examsEmpty")}</p>
            <Link to="/exams" className="btn btn--primary btn--sm">
              {t("history.examsCta")}
            </Link>
          </div>
        ) : (
          <ul className="exam-scores">
            {examHistory.slice(0, 5).map((h) => (
              <li key={`${h.lessonId}-${h.startedAt}`}>
                <span className="exam-scores__name">{lessonName(h.lessonId, h.lessonId)}</span>
                <span className="exam-scores__date muted">
                  {new Date(h.submittedAt).toLocaleDateString(uiLang === "ja" ? "ja-JP" : uiLang === "en" ? "en-GB" : "vi-VN")}
                </span>
                <span className="exam-scores__score tabular">
                  <strong>{h.correct}/{h.total}</strong>
                  <span>{h.total ? Math.round((h.correct / h.total) * 100) : 0}%</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {examHistory.length > 0 && (
          <Link to="/exams" className="exam-scores__all">
            {t("history.examsCta")} →
          </Link>
        )}
      </section>

      <section className="panel card-pad" style={{ marginBottom: 16 }}>
        <div className="card-pad__head">
          <h2>{t("history.achievements")}</h2>
          <span className="tabular">
            {badges.filter((b) => b.unlocked).length} / {badges.length}
          </span>
        </div>
        <ul className="achievements">
          {badges.map((b) => (
            <li key={b.id} className={`achievement${b.unlocked ? " is-unlocked" : ""}`}>
              <span className="achievement__icon">
                <Icon name={b.unlocked ? "check" : "lock"} size={16} strokeWidth={2} />
              </span>
              <div>
                <strong>{b.name[uiLang]}</strong>
                <span>{b.desc[uiLang]}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel table-card">
        <div className="table-card__head">
          <h2>{t("history.recent")}</h2>
          <Link to="/lessons" className="btn btn--soft btn--sm">
            {t("history.newPractice")}
          </Link>
        </div>
        {sessions.length === 0 ? (
          <div className="empty">
            <h3>{t("history.emptyTitle")}</h3>
            <p>{t("history.emptyBody")}</p>
            <Link to="/lessons" className="btn btn--primary">
              {t("history.emptyCta")}
            </Link>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">{t("history.colTime")}</th>
                <th scope="col">{t("history.colLesson")}</th>
                <th scope="col">{t("history.colResult")}</th>
                <th scope="col">{t("history.colScore")}</th>
                <th scope="col">
                  <span className="visually-hidden">{t("history.practiceAgain")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((item) => (
                <tr key={item.id}>
                  <td className="num muted">
                    {new Date(item.timestamp).toLocaleString(uiLang === "ja" ? "ja-JP" : uiLang === "en" ? "en-GB" : "vi-VN", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td style={{ fontWeight: 600 }}>{lessonName(item.lessonId, item.lessonTitle)}</td>
                  <td className="num">
                    {item.correctCount} / {item.totalCount} {t("history.correctUnit")}
                  </td>
                  <td className="num" style={{ fontWeight: 600 }}>{item.score}%</td>
                  <td style={{ textAlign: "right" }}>
                    <Link to={`/lessons/${encodeURIComponent(item.lessonId)}/dictation`} className="btn btn--outline btn--sm">
                      {t("history.practiceAgain")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </AppShell>
  );
}
