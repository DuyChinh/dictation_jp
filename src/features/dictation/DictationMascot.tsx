import { useEffect, useRef, useState } from "react";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";
import { saveSettings, type MascotType } from "../../shared/storage/settingsStore";

export type MascotMood = "listening" | "correct" | "accepted" | "incorrect" | "streak" | "idle";

type DictationMascotProps = {
  mascot: MascotType;
  mood: MascotMood;
  streakCount?: number;
  score?: number;
  onSelectMascot?: (m: MascotType) => void;
  onPet?: () => void;
};

const MASCOT_CONFIG: Record<
  MascotType,
  {
    name: { vi: string; ja: string; en: string };
    title: { vi: string; ja: string; en: string };
    icon: string;
  }
> = {
  shiba: {
    name: { vi: "Shiba Sensei", ja: "柴犬先生", en: "Shiba Sensei" },
    title: { vi: "Ninja Thông Thái", ja: "忍者マスター", en: "Ninja Master" },
    icon: "🐶",
  },
  kitsune: {
    name: { vi: "Cáo Thần Inari", ja: "稲荷キツネ", en: "Inari Kitsune" },
    title: { vi: "Linh Hồ Trí Tuệ", ja: "知恵の狐", en: "Wise Fox" },
    icon: "🦊",
  },
  neko: {
    name: { vi: "Mèo Thần Tài", ja: "招き猫", en: "Lucky Neko" },
    title: { vi: "Cát Tường May Mắn", ja: "幸運の招き猫", en: "Fortune Cat" },
    icon: "🐱",
  },
  panda: {
    name: { vi: "Panda Sư Phụ", ja: "パンダ師匠", en: "Master Panda" },
    title: { vi: "Tĩnh Tâm Luyện Nghe", ja: "精神集中", en: "Zen Master" },
    icon: "🐼",
  },
};

export function DictationMascot({
  mascot,
  mood,
  streakCount = 0,
  score,
  onSelectMascot,
  onPet,
}: DictationMascotProps) {
  const { uiLang } = useUiLanguage();
  const [bounce, setBounce] = useState(false);
  const [showSelector, setShowSelector] = useState(false);
  const selectorRef = useRef<HTMLDivElement | null>(null);

  // Close selector dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
        setShowSelector(false);
      }
    };
    if (showSelector) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSelector]);

  // Only trigger bounce on check results (correct/incorrect), NEVER on listening or replay!
  useEffect(() => {
    if (mood === "correct" || mood === "incorrect" || mood === "streak") {
      setBounce(true);
      const t = setTimeout(() => setBounce(false), 600);
      return () => clearTimeout(t);
    }
    setBounce(false);
  }, [mood, streakCount]);

  const config = MASCOT_CONFIG[mascot] || MASCOT_CONFIG.shiba;
  const isFire = streakCount >= 3;

  // Speech bubble texts
  const getSpeechText = () => {
    if (streakCount >= 3) {
      if (uiLang === "vi") return `🔥 Combo x${streakCount}! Đôi tai thần sầu!`;
      if (uiLang === "ja") return `🔥 ${streakCount}問連続正解！絶好調！`;
      return `🔥 ${streakCount} Streak! Unstoppable!`;
    }

    switch (mood) {
      case "correct": {
        const viOptions = ["Tuyệt đỉnh! Chuẩn 100%!", "Chính xác từng chữ!", "Đôi tai vàng N2!", "Xuất sắc!"];
        const jaOptions = ["すばらしい！満点！", "完璧です！", "その調子！", "お見事！"];
        const enOptions = ["Perfect score!", "Brilliant listening!", "Spot on!", "Outstanding!"];
        const idx = Math.floor(Math.random() * viOptions.length);
        return uiLang === "vi" ? viOptions[idx] : uiLang === "ja" ? jaOptions[idx] : enOptions[idx];
      }
      case "accepted": {
        if (uiLang === "vi") return "Chuẩn cách đọc! Lần sau thử Kanji nhé ✨";
        if (uiLang === "ja") return "読み方バッチリ！次は漢字も挑戦✨";
        return "Great phonetic match! Try Kanji next time ✨";
      }
      case "incorrect": {
        const viOptions = ["Cố lên! Nghe lại một lần nữa nhé 💪", "Không sao, luyện tai nghe thêm chút nào!", "Đừng nản lòng, thử lại nhé!"];
        const jaOptions = ["もう一度聞いてみよう！💪", "惜しい！諦めないで！", "大丈夫、次はいける！"];
        const enOptions = ["Keep going! Listen again 💪", "Almost there, try once more!", "Don't give up!"];
        const idx = Math.floor(Math.random() * viOptions.length);
        return uiLang === "vi" ? viOptions[idx] : uiLang === "ja" ? jaOptions[idx] : enOptions[idx];
      }
      case "listening": {
        if (uiLang === "vi") return "🎧 Đang lắng nghe thật kỹ...";
        if (uiLang === "ja") return "🎧 集中して聞いています...";
        return "🎧 Listening attentively...";
      }
      default: {
        if (uiLang === "vi") return "Sẵn sàng chinh phục câu tiếp theo!";
        if (uiLang === "ja") return "次の問題にいってみよう！";
        return "Ready for the next sentence!";
      }
    }
  };

  const handleSelect = (m: MascotType) => {
    saveSettings({ mascot: m });
    onSelectMascot?.(m);
    setShowSelector(false);
  };

  return (
    <div style={{ position: "relative" }} ref={selectorRef}>
      <div
        className={`mascot-card-wrapper ${bounce ? "mascot-bounce" : ""} ${isFire ? "mascot-fire" : ""}`}
        onClick={() => setShowSelector((v) => !v)}
        title="Nhấn để đổi Linh vật đồng hành"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.85rem",
          padding: "0.5rem 0.85rem",
          background: isFire
            ? "linear-gradient(135deg, rgba(249, 115, 22, 0.18), rgba(239, 68, 68, 0.22))"
            : "linear-gradient(135deg, rgba(56, 189, 248, 0.08), rgba(99, 102, 241, 0.12))",
          borderRadius: "14px",
          border: isFire
            ? "1px solid rgba(249, 115, 22, 0.45)"
            : "1px solid rgba(255, 255, 255, 0.12)",
          backdropFilter: "blur(12px)",
          boxShadow: isFire
            ? "0 0 16px rgba(249, 115, 22, 0.3)"
            : "0 4px 12px rgba(0, 0, 0, 0.15)",
          cursor: "pointer",
          userSelect: "none",
          transition: "all 0.3s ease",
        }}
      >
        {/* Animated Mascot Character SVG */}
        <div
          style={{ position: "relative", width: 56, height: 56, flexShrink: 0 }}
          onClick={(e) => {
            if (onPet) {
              e.stopPropagation();
              onPet();
            }
          }}
          title="Nhấn để tương tác với Linh vật"
        >
          {isFire && <div className="mascot-flame-aura" />}

          {mascot === "kitsune" ? (
            <KitsuneSvg mood={mood} />
          ) : mascot === "neko" ? (
            <NekoSvg mood={mood} />
          ) : mascot === "panda" ? (
            <PandaSvg mood={mood} />
          ) : (
            <ShibaSvg mood={mood} />
          )}
        </div>

        {/* Speech bubble & Mascot identity */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2, maxWidth: 210 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 800,
                  color: isFire ? "#f97316" : "var(--primary-color)",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                {isFire ? `🔥 Combo x${streakCount}` : config.name[uiLang] || config.name.vi}
              </span>
              {score != null && (
                <span
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    padding: "1px 5px",
                    borderRadius: "4px",
                    background: score === 100 ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)",
                    color: score === 100 ? "#22c55e" : "#ef4444",
                  }}
                >
                  {score}%
                </span>
              )}
            </div>

            <span
              style={{
                fontSize: "0.68rem",
                color: "var(--text-muted)",
                background: "rgba(255, 255, 255, 0.08)",
                padding: "1px 5px",
                borderRadius: "4px",
                whiteSpace: "nowrap",
              }}
            >
              Đổi ▾
            </span>
          </div>

          <div style={{ fontSize: "0.83rem", fontWeight: 600, color: "var(--text-main)", lineHeight: 1.3 }}>
            {getSpeechText()}
          </div>
        </div>
      </div>

      {/* Mascot Selector Popup Dropdown */}
      {showSelector && (
        <div
          className="card-glass"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            zIndex: 1000,
            width: "280px",
            padding: "0.75rem",
            borderRadius: "14px",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.4)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            background: "var(--bg-card)",
          }}
        >
          <div
            style={{
              fontSize: "0.85rem",
              fontWeight: 700,
              marginBottom: "0.6rem",
              paddingBottom: "0.4rem",
              borderBottom: "1px solid var(--border-color)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>✨ Chọn Linh vật đồng hành</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowSelector(false);
              }}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                fontSize: "1rem",
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {(Object.keys(MASCOT_CONFIG) as MascotType[]).map((key) => {
              const item = MASCOT_CONFIG[key];
              const isSelected = mascot === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(key);
                  }}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    padding: "0.6rem 0.4rem",
                    borderRadius: "10px",
                    border: isSelected ? "2px solid var(--primary-color)" : "1px solid var(--border-color)",
                    background: isSelected ? "var(--primary-light)" : "rgba(255, 255, 255, 0.03)",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  <span style={{ fontSize: "1.6rem", marginBottom: 2 }}>{item.icon}</span>
                  <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-main)" }}>
                    {item.name[uiLang] || item.name.vi}
                  </span>
                  <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                    {item.title[uiLang] || item.title.vi}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ==========================================
   Mascot Vector Illustrations
   ========================================== */

function ShibaSvg({ mood }: { mood: MascotMood }) {
  return (
    <svg viewBox="0 0 100 100" width="56" height="56" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="shibaFur" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
        <linearGradient id="shibaWhite" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#fef3c7" />
        </linearGradient>
      </defs>
      <polygon points="20,40 10,12 40,25" fill="url(#shibaFur)" stroke="#b45309" strokeWidth="2" />
      <polygon points="22,35 15,18 36,25" fill="#fecdd3" />
      <polygon points="80,40 90,12 60,25" fill="url(#shibaFur)" stroke="#b45309" strokeWidth="2" />
      <polygon points="78,35 85,18 64,25" fill="#fecdd3" />
      <circle cx="50" cy="52" r="36" fill="url(#shibaFur)" stroke="#b45309" strokeWidth="2" />
      <path d="M 22 56 Q 30 40 50 48 Q 70 40 78 56 Q 74 82 50 84 Q 26 82 22 56 Z" fill="url(#shibaWhite)" />
      
      {/* Headband */}
      <path d="M 16 42 Q 50 36 84 42 L 86 34 Q 50 28 14 34 Z" fill="#ef4444" />
      <circle cx="50" cy="36" r="4" fill="#ffffff" />
      <text x="50" y="38" fontSize="5" fontWeight="bold" textAnchor="middle" fill="#dc2626">必</text>

      {/* Headphones */}
      <path d="M 12 50 A 40 40 0 0 1 88 50" fill="none" stroke="#3b82f6" strokeWidth="5" strokeLinecap="round" />
      <rect x="8" y="44" width="8" height="18" rx="4" fill="#3b82f6" />
      <rect x="84" y="44" width="8" height="18" rx="4" fill="#3b82f6" />
      <circle cx="12" cy="53" r="2.5" fill="#38bdf8" />
      <circle cx="88" cy="53" r="2.5" fill="#38bdf8" />

      {/* Eyes & Mouth */}
      {mood === "correct" || mood === "streak" ? (
        <g stroke="#1e293b" strokeWidth="3" strokeLinecap="round" fill="none">
          <path d="M 32 54 Q 38 46 44 54" />
          <path d="M 56 54 Q 62 46 68 54" />
        </g>
      ) : mood === "incorrect" ? (
        <g>
          <ellipse cx="38" cy="52" rx="4" ry="4.5" fill="#1e293b" />
          <circle cx="39" cy="50" r="1.5" fill="#ffffff" />
          <ellipse cx="62" cy="52" rx="4" ry="4.5" fill="#1e293b" />
          <circle cx="63" cy="50" r="1.5" fill="#ffffff" />
          <path d="M 33 46 L 43 49" stroke="#78350f" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 67 46 L 57 49" stroke="#78350f" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      ) : (
        <g>
          <ellipse cx="38" cy="52" rx="4.5" ry="5.5" fill="#1e293b" />
          <circle cx="39.5" cy="50" r="2" fill="#ffffff" />
          <ellipse cx="62" cy="52" rx="4.5" ry="5.5" fill="#1e293b" />
          <circle cx="63.5" cy="50" r="2" fill="#ffffff" />
        </g>
      )}

      <ellipse cx="28" cy="62" rx="4.5" ry="2.5" fill="#fb7185" opacity="0.6" />
      <ellipse cx="72" cy="62" rx="4.5" ry="2.5" fill="#fb7185" opacity="0.6" />
      <polygon points="50,60 46,56 54,56" fill="#1e293b" />

      {mood === "correct" || mood === "streak" ? (
        <path d="M 44 64 Q 50 74 56 64 Z" fill="#ef4444" stroke="#1e293b" strokeWidth="1.5" />
      ) : (
        <path d="M 44 63 Q 47 66 50 63 Q 53 66 56 63" fill="none" stroke="#1e293b" strokeWidth="1.8" strokeLinecap="round" />
      )}

      {mood === "listening" && (
        <g className="floating-music-notes" fill="#38bdf8" fontSize="12" fontWeight="bold">
          <text x="76" y="24" className="note-1">♪</text>
          <text x="86" y="38" className="note-2">♫</text>
        </g>
      )}
    </svg>
  );
}

function KitsuneSvg({ mood }: { mood: MascotMood }) {
  return (
    <svg viewBox="0 0 100 100" width="56" height="56" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="kitsuneFur" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f8fafc" />
        </linearGradient>
      </defs>
      {/* Pointy fox ears */}
      <polygon points="22,42 6,6 40,24" fill="#ffffff" stroke="#ef4444" strokeWidth="2" />
      <polygon points="20,38 12,14 36,25" fill="#ef4444" />
      <polygon points="78,42 94,6 60,24" fill="#ffffff" stroke="#ef4444" strokeWidth="2" />
      <polygon points="80,38 88,14 64,25" fill="#ef4444" />
      
      {/* Kitsune Head */}
      <circle cx="50" cy="52" r="35" fill="url(#kitsuneFur)" stroke="#e2e8f0" strokeWidth="2" />

      {/* Fox Inari Red Markings */}
      <path d="M 28 42 Q 35 34 38 46" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M 72 42 Q 65 34 62 46" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="50" cy="34" r="3" fill="#ef4444" />

      {/* Headphones */}
      <path d="M 12 50 A 40 40 0 0 1 88 50" fill="none" stroke="#dc2626" strokeWidth="4.5" strokeLinecap="round" />
      <rect x="8" y="44" width="8" height="18" rx="4" fill="#dc2626" />
      <rect x="84" y="44" width="8" height="18" rx="4" fill="#dc2626" />
      <circle cx="12" cy="53" r="2.5" fill="#facc15" />
      <circle cx="88" cy="53" r="2.5" fill="#facc15" />

      {/* Eyes */}
      {mood === "correct" || mood === "streak" ? (
        <g stroke="#dc2626" strokeWidth="3" strokeLinecap="round" fill="none">
          <path d="M 32 54 Q 38 46 44 54" />
          <path d="M 56 54 Q 62 46 68 54" />
        </g>
      ) : (
        <g stroke="#1e293b" strokeWidth="2.8" strokeLinecap="round" fill="none">
          <path d="M 30 54 Q 38 50 44 56" />
          <path d="M 70 54 Q 62 50 56 56" />
        </g>
      )}

      {/* Nose & Mouth */}
      <polygon points="50,62 47,58 53,58" fill="#1e293b" />
      <path d="M 46 65 Q 50 68 54 65" fill="none" stroke="#1e293b" strokeWidth="1.8" strokeLinecap="round" />

      {mood === "listening" && (
        <g className="floating-music-notes" fill="#ef4444" fontSize="12" fontWeight="bold">
          <text x="76" y="24" className="note-1">♪</text>
          <text x="86" y="38" className="note-2">♫</text>
        </g>
      )}
    </svg>
  );
}

function NekoSvg({ mood }: { mood: MascotMood }) {
  return (
    <svg viewBox="0 0 100 100" width="56" height="56" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="nekoFur" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f1f5f9" />
        </linearGradient>
      </defs>
      {/* Cat ears */}
      <polygon points="20,40 14,14 42,26" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" />
      <polygon points="22,36 18,20 38,28" fill="#f43f5e" />
      <polygon points="80,40 86,14 58,26" fill="#f97316" stroke="#ea580c" strokeWidth="2" />
      <polygon points="78,36 82,20 62,28" fill="#fed7aa" />

      {/* Head */}
      <circle cx="50" cy="52" r="35" fill="url(#nekoFur)" stroke="#e2e8f0" strokeWidth="2" />
      {/* Calico Spot */}
      <path d="M 64 26 Q 82 32 82 50 Q 68 56 64 40 Z" fill="#f97316" opacity="0.85" />

      {/* Headphones */}
      <path d="M 12 50 A 40 40 0 0 1 88 50" fill="none" stroke="#ec4899" strokeWidth="4.5" strokeLinecap="round" />
      <rect x="8" y="44" width="8" height="18" rx="4" fill="#ec4899" />
      <rect x="84" y="44" width="8" height="18" rx="4" fill="#ec4899" />

      {/* Gold Bell Necklace */}
      <circle cx="50" cy="85" r="6" fill="#fbbf24" stroke="#d97706" strokeWidth="1.5" />
      <circle cx="50" cy="85" r="1.5" fill="#78350f" />

      {/* Eyes */}
      {mood === "correct" || mood === "streak" ? (
        <g stroke="#1e293b" strokeWidth="3" strokeLinecap="round" fill="none">
          <path d="M 32 54 Q 38 46 44 54" />
          <path d="M 56 54 Q 62 46 68 54" />
        </g>
      ) : (
        <g>
          <circle cx="38" cy="52" r="4.5" fill="#1e293b" />
          <circle cx="39.5" cy="50.5" r="1.8" fill="#ffffff" />
          <circle cx="62" cy="52" r="4.5" fill="#1e293b" />
          <circle cx="63.5" cy="50.5" r="1.8" fill="#ffffff" />
        </g>
      )}

      {/* Whiskers */}
      <path d="M 22 56 L 12 54 M 22 60 L 14 62" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M 78 56 L 88 54 M 78 60 L 86 62" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />

      {/* Nose & w-mouth */}
      <polygon points="50,59 47,56 53,56" fill="#f43f5e" />
      <path d="M 44 63 Q 47 66 50 63 Q 53 66 56 63" fill="none" stroke="#1e293b" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PandaSvg({ mood }: { mood: MascotMood }) {
  return (
    <svg viewBox="0 0 100 100" width="56" height="56" style={{ overflow: "visible" }}>
      {/* Panda round black ears */}
      <circle cx="20" cy="25" r="14" fill="#1e293b" />
      <circle cx="80" cy="25" r="14" fill="#1e293b" />

      {/* Head */}
      <circle cx="50" cy="52" r="35" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" />

      {/* Black Eye Patches */}
      <ellipse cx="36" cy="50" rx="9" ry="11" transform="rotate(-15 36 50)" fill="#1e293b" />
      <ellipse cx="64" cy="50" rx="9" ry="11" transform="rotate(15 64 50)" fill="#1e293b" />

      {/* Headphones */}
      <path d="M 12 50 A 40 40 0 0 1 88 50" fill="none" stroke="#10b981" strokeWidth="4.5" strokeLinecap="round" />
      <rect x="8" y="44" width="8" height="18" rx="4" fill="#10b981" />
      <rect x="84" y="44" width="8" height="18" rx="4" fill="#10b981" />

      {/* Eyes */}
      {mood === "correct" || mood === "streak" ? (
        <g stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" fill="none">
          <path d="M 32 50 Q 36 44 40 50" />
          <path d="M 60 50 Q 64 44 68 50" />
        </g>
      ) : (
        <g>
          <circle cx="36" cy="49" r="3.5" fill="#ffffff" />
          <circle cx="37" cy="48" r="1.5" fill="#1e293b" />
          <circle cx="64" cy="49" r="3.5" fill="#ffffff" />
          <circle cx="65" cy="48" r="1.5" fill="#1e293b" />
        </g>
      )}

      {/* Blush */}
      <ellipse cx="26" cy="62" rx="4" ry="2" fill="#f43f5e" opacity="0.5" />
      <ellipse cx="74" cy="62" rx="4" ry="2" fill="#f43f5e" opacity="0.5" />

      {/* Nose & Mouth */}
      <ellipse cx="50" cy="59" rx="5" ry="3.5" fill="#1e293b" />
      <path d="M 45 64 Q 50 68 55 64" fill="none" stroke="#1e293b" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
