import { useSyncExternalStore } from "react";
import { Icon } from "../ui/Icon";
import { useUiLanguage } from "../i18n/UiLanguageContext";

const text: Record<string, string> = {
  vi: "Bạn đang offline. Flashcard và game vẫn học được, bài làm được lưu trên máy và đồng bộ khi có mạng.",
  en: "You are offline. Flashcards and games still work; your progress is kept on this device and synced when you are back online.",
  ja: "オフラインです。フラッシュカードとゲームは使えます。学習内容は端末に保存され、接続すると同期されます。",
};

const subscribe = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};
const online = () => navigator.onLine;

/** Whether the browser says there is a connection. */
export const useOnline = (): boolean => useSyncExternalStore(subscribe, online, () => true);

/** A slim bar under the header while there is no network. */
export function OfflineNotice() {
  const { uiLang } = useUiLanguage();
  if (useOnline()) return null;
  return (
    <p className="offline-notice" role="status">
      <Icon name="alert" size={16} /> {(text[uiLang] ?? text.vi)!.normalize("NFC")}
    </p>
  );
}
