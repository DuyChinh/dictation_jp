import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LanguageProvider } from "../shared/content/LanguageProvider";
import { HomePage } from "../pages/HomePage";
import { LessonPage } from "../pages/LessonPage";
import { DictationPage } from "../pages/DictationPage";
import { ListeningPage } from "../pages/ListeningPage";
import { GoogleCallbackPage } from "../pages/GoogleCallbackPage";
import { AuthProvider } from "../features/auth/AuthContext";
import { ThemeProvider } from "../shared/theme/ThemeProvider";
import { UiLanguageProvider } from "../shared/i18n/UiLanguageContext";

export function AppRouter() {
  return (
    <ThemeProvider>
      <UiLanguageProvider>
        <AuthProvider>
          <LanguageProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
                <Route path="/lessons/:lessonId" element={<LessonPage />} />
                <Route
                  path="/lessons/:lessonId/dictation"
                  element={<DictationPage />}
                />
                <Route
                  path="/lessons/:lessonId/listening"
                  element={<ListeningPage />}
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </LanguageProvider>
        </AuthProvider>
      </UiLanguageProvider>
    </ThemeProvider>
  );
}
