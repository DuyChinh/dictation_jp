import { lazy, Suspense, type ComponentType } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LanguageProvider } from "../shared/content/LanguageProvider";
import { HomePage } from "../pages/HomePage";
import { AuthProvider } from "../features/auth/AuthContext";
import { ThemeProvider } from "../shared/theme/ThemeProvider";
import { UiLanguageProvider } from "../shared/i18n/UiLanguageContext";
import { LevelProvider } from "../shared/context/LevelContext";
import { PageViewTracker } from "../shared/analytics/PageViewTracker";
import { SeoManager } from "../shared/seo/SeoManager";

const RELOADED_KEY = "jd.chunk_reload";

/**
 * A lazy page whose file can't be fetched (a deploy replaced it, or the dev server re-bundled)
 * reloads the app once to pick up the current files instead of crashing.
 */
function lazyPage<T extends ComponentType>(load: () => Promise<{ default: T }>) {
  return lazy(() =>
    load().then(
      (mod) => {
        sessionStorage.removeItem(RELOADED_KEY);
        return mod;
      },
      (error) => {
        if (sessionStorage.getItem(RELOADED_KEY)) throw error;
        sessionStorage.setItem(RELOADED_KEY, "1");
        window.location.reload();
        return new Promise<never>(() => {});
      },
    ),
  );
}

// Every page but the landing page is fetched when it is first visited, which keeps the first download small.
const HistoryPage = lazyPage(() => import("../pages/HistoryPage").then((m) => ({ default: m.HistoryPage })));
const LessonsPage = lazyPage(() => import("../pages/LessonsPage").then((m) => ({ default: m.LessonsPage })));
const ExamRoomPage = lazyPage(() => import("../pages/ExamRoomPage").then((m) => ({ default: m.ExamRoomPage })));
const ExamHistoryPage = lazyPage(() => import("../pages/ExamHistoryPage").then((m) => ({ default: m.ExamHistoryPage })));
const LeaderboardPage = lazyPage(() => import("../pages/LeaderboardPage").then((m) => ({ default: m.LeaderboardPage })));
const DictionaryPage = lazyPage(() => import("../pages/DictionaryPage").then((m) => ({ default: m.DictionaryPage })));
const FlashcardsPage = lazyPage(() => import("../pages/FlashcardsPage").then((m) => ({ default: m.FlashcardsPage })));
const FlashcardCreatePage = lazyPage(() => import("../pages/FlashcardCreatePage").then((m) => ({ default: m.FlashcardCreatePage })));
const FlashcardDeckPage = lazyPage(() => import("../pages/FlashcardDeckPage").then((m) => ({ default: m.FlashcardDeckPage })));
const FlashcardStudyPage = lazyPage(() => import("../pages/FlashcardStudyPage").then((m) => ({ default: m.FlashcardStudyPage })));
const FlashcardSharedPage = lazyPage(() => import("../pages/FlashcardSharedPage").then((m) => ({ default: m.FlashcardSharedPage })));
const FlashcardSharedStudyPage = lazyPage(() => import("../pages/FlashcardSharedPage").then((m) => ({ default: m.FlashcardSharedStudyPage })));
const PricingPage = lazyPage(() => import("../pages/PricingPage").then((m) => ({ default: m.PricingPage })));
const ProfilePage = lazyPage(() => import("../pages/ProfilePage").then((m) => ({ default: m.ProfilePage })));
const FeedbackPage = lazyPage(() => import("../pages/FeedbackPage").then((m) => ({ default: m.FeedbackPage })));
const LessonPage = lazyPage(() => import("../pages/LessonPage").then((m) => ({ default: m.LessonPage })));
const DictationPage = lazyPage(() => import("../pages/DictationPage").then((m) => ({ default: m.DictationPage })));
const ListeningPage = lazyPage(() => import("../pages/ListeningPage").then((m) => ({ default: m.ListeningPage })));
const PaperPage = lazyPage(() => import("../pages/PaperPage").then((m) => ({ default: m.PaperPage })));
const PaperOverviewPage = lazyPage(() => import("../pages/PaperOverviewPage").then((m) => ({ default: m.PaperOverviewPage })));
const PaperExamPage = lazyPage(() => import("../pages/PaperExamPage").then((m) => ({ default: m.PaperExamPage })));
const PaperExamSetupPage = lazyPage(() => import("../pages/PaperExamSetupPage").then((m) => ({ default: m.PaperExamSetupPage })));
const PaperExamReviewPage = lazyPage(() => import("../pages/PaperExamReviewPage").then((m) => ({ default: m.PaperExamReviewPage })));
const PaperExamResultPage = lazyPage(() => import("../pages/PaperExamResultPage").then((m) => ({ default: m.PaperExamResultPage })));
const ListeningResultPage = lazyPage(() => import("../pages/ListeningResultPage").then((m) => ({ default: m.ListeningResultPage })));
const AuthPage = lazyPage(() => import("../pages/AuthPage").then((m) => ({ default: m.AuthPage })));
const ForgotPasswordPage = lazyPage(() => import("../pages/ForgotPasswordPage").then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazyPage(() => import("../pages/ResetPasswordPage").then((m) => ({ default: m.ResetPasswordPage })));
const GoogleCallbackPage = lazyPage(() => import("../pages/GoogleCallbackPage").then((m) => ({ default: m.GoogleCallbackPage })));

const AdminApp = lazyPage(() => import("../admin/AdminApp"));
// The QR library is only needed here, so it stays out of the main bundle.
const DonatePage = lazyPage(() => import("../pages/DonatePage").then((m) => ({ default: m.DonatePage })));

export function AppRouter() {
  return (
    <ThemeProvider>
      <UiLanguageProvider>
        <LevelProvider>
          <AuthProvider>
            <LanguageProvider>
              <BrowserRouter>
              <PageViewTracker />
              <SeoManager />
              <Suspense fallback={null}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/lessons" element={<LessonsPage />} />
                <Route path="/exams" element={<ExamRoomPage />} />
                <Route path="/exams/history" element={<ExamHistoryPage />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/leaderboard" element={<LeaderboardPage />} />
                <Route path="/dictionary" element={<DictionaryPage />} />
                <Route path="/flashcards" element={<FlashcardsPage />} />
                <Route path="/flashcards/create" element={<FlashcardCreatePage />} />
                <Route path="/flashcards/shared/:shareId" element={<FlashcardSharedPage />} />
                <Route path="/flashcards/shared/:shareId/:mode" element={<FlashcardSharedStudyPage />} />
                <Route path="/flashcards/:deckId" element={<FlashcardDeckPage />} />
                <Route path="/flashcards/:deckId/:mode" element={<FlashcardStudyPage />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/feedback" element={<FeedbackPage />} />
                <Route
                  path="/donate"
                  element={
                    <Suspense fallback={null}>
                      <DonatePage />
                    </Suspense>
                  }
                />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
                <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
                <Route path="/lessons/:lessonId" element={<LessonPage />} />
                <Route
                  path="/lessons/:lessonId/dictation"
                  element={<DictationPage />}
                />
                <Route
                  path="/lessons/:lessonId/paper"
                  element={<PaperOverviewPage />}
                />
                <Route
                  path="/lessons/:lessonId/paper/exam/setup"
                  element={<PaperExamSetupPage />}
                />
                <Route
                  path="/lessons/:lessonId/paper/exam/result"
                  element={<PaperExamResultPage />}
                />
                <Route
                  path="/lessons/:lessonId/paper/exam/review"
                  element={<PaperExamReviewPage />}
                />
                <Route
                  path="/lessons/:lessonId/paper/exam"
                  element={<PaperExamPage />}
                />
                <Route
                  path="/lessons/:lessonId/paper/:part"
                  element={<PaperPage />}
                />
                <Route
                  path="/lessons/:lessonId/listening"
                  element={<ListeningPage />}
                />
                <Route
                  path="/lessons/:lessonId/listening/result"
                  element={<ListeningResultPage />}
                />
                <Route
                  path="/admin/*"
                  element={
                    <Suspense fallback={null}>
                      <AdminApp />
                    </Suspense>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              </Suspense>
            </BrowserRouter>
          </LanguageProvider>
        </AuthProvider>
      </LevelProvider>
    </UiLanguageProvider>
  </ThemeProvider>
);
}
