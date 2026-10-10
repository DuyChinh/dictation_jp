import { lazy, Suspense, type ComponentType } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LanguageProvider } from "../shared/content/LanguageProvider";
import { HomePage } from "../pages/HomePage";
import { HistoryPage } from "../pages/HistoryPage";
import { LessonsPage } from "../pages/LessonsPage";
import { ExamRoomPage } from "../pages/ExamRoomPage";
import { ExamHistoryPage } from "../pages/ExamHistoryPage";
import { PricingPage } from "../pages/PricingPage";
import { ProfilePage } from "../pages/ProfilePage";
import { FeedbackPage } from "../pages/FeedbackPage";
import { LessonPage } from "../pages/LessonPage";
import { DictationPage } from "../pages/DictationPage";
import { ListeningPage } from "../pages/ListeningPage";
import { PaperPage } from "../pages/PaperPage";
import { PaperOverviewPage } from "../pages/PaperOverviewPage";
import { PaperExamPage } from "../pages/PaperExamPage";
import { PaperExamSetupPage } from "../pages/PaperExamSetupPage";
import { PaperExamReviewPage } from "../pages/PaperExamReviewPage";
import { PaperExamResultPage } from "../pages/PaperExamResultPage";
import { ListeningResultPage } from "../pages/ListeningResultPage";
import { AuthPage } from "../pages/AuthPage";
import { ForgotPasswordPage } from "../pages/ForgotPasswordPage";
import { ResetPasswordPage } from "../pages/ResetPasswordPage";
import { GoogleCallbackPage } from "../pages/GoogleCallbackPage";
import { AuthProvider } from "../features/auth/AuthContext";
import { ThemeProvider } from "../shared/theme/ThemeProvider";
import { UiLanguageProvider } from "../shared/i18n/UiLanguageContext";
import { LevelProvider } from "../shared/context/LevelContext";

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
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/lessons" element={<LessonsPage />} />
                <Route path="/exams" element={<ExamRoomPage />} />
                <Route path="/exams/history" element={<ExamHistoryPage />} />
                <Route path="/history" element={<HistoryPage />} />
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
            </BrowserRouter>
          </LanguageProvider>
        </AuthProvider>
      </LevelProvider>
    </UiLanguageProvider>
  </ThemeProvider>
);
}
