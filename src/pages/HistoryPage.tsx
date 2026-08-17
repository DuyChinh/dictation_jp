import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../shared/ui/AppShell";
import { useUiLanguage } from "../shared/i18n/UiLanguageContext";
import { loadSettings } from "../shared/storage/settingsStore";
import {
  getUserStats,
  getPracticeHistory,
  syncHistoryFromServer,
  type UserOverallStats,
  type PracticeSessionItem,
} from "../shared/storage/practiceHistoryStore";

export function HistoryPage() {
  const { uiLang } = useUiLanguage();
  const settings = loadSettings();
  const mascotKey = settings.mascot || "shiba";

  const [stats, setStats] = useState<UserOverallStats>(() => getUserStats());
  const [history, setHistory] = useState<PracticeSessionItem[]>(() => getPracticeHistory());

  useEffect(() => {
    let cancelled = false;
    syncHistoryFromServer().then((res) => {
      if (!cancelled) {
        setStats(res.stats);
        setHistory(res.history);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const accuracy = stats.totalAttempts > 0
    ? Math.round((stats.totalCorrect / stats.totalAttempts) * 100)
    : 0;

  // Mascot Rank and Title
  const getMascotRank = () => {
    if (stats.bestStreak >= 15) {
      return {
        title: uiLang === "vi" ? "👑 Đại Sư Phụ Huyền Thoại" : uiLang === "ja" ? "👑 伝説のマスター" : "👑 Legendary Master",
        desc: uiLang === "vi" ? "Đôi tai thần sầu bất khả chiến bại!" : uiLang === "ja" ? "無敵のリスニング力！" : "Unstoppable golden ears!",
        flame: true,
      };
    }
    if (stats.bestStreak >= 10) {
      return {
        title: uiLang === "vi" ? "⚡ Bậc Thầy Đôi Tai Vàng" : uiLang === "ja" ? "⚡ 黄金の耳マスター" : "⚡ Golden Ear Master",
        desc: uiLang === "vi" ? "Khả năng nghe và phản xạ cực kỳ xuất sắc!" : uiLang === "ja" ? "素晴らしい反射神経と聴解力！" : "Exceptional listening and reflexes!",
        flame: true,
      };
    }
    if (stats.bestStreak >= 5) {
      return {
        title: uiLang === "vi" ? "🔥 Chiến Binh Rực Lửa" : uiLang === "ja" ? "🔥 炎のチャレンジャー" : "🔥 Blazing Challenger",
        desc: uiLang === "vi" ? "Phong độ đang lên rất cao, tiếp tục giữ vững nhé!" : uiLang === "ja" ? "絶好調！この調子で進もう！" : "Great momentum, keep it up!",
        flame: true,
      };
    }
    return {
      title: uiLang === "vi" ? "🌱 Tân Binh Luyện Nghe" : uiLang === "ja" ? "🌱 リスニングルーキー" : "🌱 Dictation Rookie",
      desc: uiLang === "vi" ? "Mỗi ngày một chút, bạn sẽ bứt phá không ngờ!" : uiLang === "ja" ? "毎日の積み重ねが大きな力に！" : "Every day brings steady progress!",
      flame: false,
    };
  };

  const mascotRank = getMascotRank();

  // Achievement Badges
  const badges = [
    {
      id: "first_step",
      icon: "🎯",
      name: uiLang === "vi" ? "Khởi Đầu Nan" : uiLang === "ja" ? "最初の一歩" : "First Step",
      desc: uiLang === "vi" ? "Hoàn thành ít nhất 1 câu dictation" : uiLang === "ja" ? "ディクテーションを1問解く" : "Complete 1 dictation segment",
      unlocked: stats.totalAttempts >= 1,
    },
    {
      id: "streak_5",
      icon: "🔥",
      name: uiLang === "vi" ? "Chuỗi Rực Lửa (x5)" : uiLang === "ja" ? "5連勝の炎" : "Blazing Streak (x5)",
      desc: uiLang === "vi" ? "Đạt chuỗi 5 câu đúng liên tiếp" : uiLang === "ja" ? "5問連続で正解を達成" : "Reach a 5-streak combo",
      unlocked: stats.bestStreak >= 5,
    },
    {
      id: "streak_10",
      icon: "⚡",
      name: uiLang === "vi" ? "Thần Sầu (x10)" : uiLang === "ja" ? "10連勝マスター" : "Combo Master (x10)",
      desc: uiLang === "vi" ? "Đạt chuỗi 10 câu đúng liên tiếp" : uiLang === "ja" ? "10問連続で正解を達成" : "Reach a 10-streak combo",
      unlocked: stats.bestStreak >= 10,
    },
    {
      id: "streak_15",
      icon: "👑",
      name: uiLang === "vi" ? "Bất Khả Chiến Bại" : uiLang === "ja" ? "無敵の達人" : "Unstoppable (x15)",
      desc: uiLang === "vi" ? "Đạt chuỗi 15 câu đúng liên tiếp" : uiLang === "ja" ? "15問連続で正解を達成" : "Reach a 15-streak combo",
      unlocked: stats.bestStreak >= 15,
    },
    {
      id: "hard_worker",
      icon: "🎧",
      name: uiLang === "vi" ? "Chiến Binh Bền Bỉ" : uiLang === "ja" ? "継続の達人" : "Persistent Fighter",
      desc: uiLang === "vi" ? "Chinh phục từ 20 câu đúng trở lên" : uiLang === "ja" ? "20問以上の正解を達成" : "Master 20+ correct segments",
      unlocked: stats.totalCorrect >= 20,
    },
    {
      id: "perfectionist",
      icon: "✨",
      name: uiLang === "vi" ? "Đôi Tai Vàng (≥90%)" : uiLang === "ja" ? "完璧主義者" : "Golden Ears (≥90%)",
      desc: uiLang === "vi" ? "Đạt tỷ lệ đúng ≥ 90% (từ 10 câu trở lên)" : uiLang === "ja" ? "正解率90%以上（10問以上）" : "Achieve ≥90% accuracy (10+ attempts)",
      unlocked: accuracy >= 90 && stats.totalAttempts >= 10,
    },
  ];

  return (
    <AppShell wide>
      <div style={{ maxWidth: 960, margin: "0 auto", paddingBottom: "3rem" }}>
        {/* Header Hero */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "0.35rem 1rem",
              borderRadius: 99,
              background: "linear-gradient(135deg, rgba(249, 115, 22, 0.15), rgba(234, 88, 12, 0.25))",
              color: "#f97316",
              fontSize: "0.85rem",
              fontWeight: 800,
              marginBottom: "0.85rem",
              border: "1px solid rgba(249, 115, 22, 0.3)",
            }}
          >
            <span>🏆</span>
            <span>BẢNG NỖ LỰC & THÀNH TÍCH LUYỆN TẬP</span>
          </div>

          <h1 style={{ fontSize: "clamp(1.6rem, 4vw, 2.2rem)", fontWeight: 800, margin: "0 0 0.5rem" }}>
            Hành Trình Chinh Phục Của Bạn
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "1rem", margin: 0 }}>
            Ghi nhận từng câu đúng, từng chuỗi combo và sự nỗ lực kiên trì mỗi ngày.
          </p>
        </div>

        {/* 4 KPI Hero Stats Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          {/* Card 1: Best Streak */}
          <div
            className="card-glass"
            style={{
              padding: "1.25rem",
              borderRadius: "16px",
              background: "linear-gradient(135deg, rgba(249, 115, 22, 0.12), rgba(239, 68, 68, 0.15))",
              border: "1px solid rgba(249, 115, 22, 0.4)",
              boxShadow: "0 8px 24px rgba(249, 115, 22, 0.15)",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#f97316", textTransform: "uppercase" }}>
                Kỷ Lục Chuỗi (Max)
              </span>
              <span style={{ fontSize: "1.4rem" }}>🔥</span>
            </div>
            <div style={{ fontSize: "2.2rem", fontWeight: 900, color: "#f97316" }}>
              {stats.bestStreak > 0 ? `x${stats.bestStreak}` : "0"}
            </div>
            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
              {stats.currentStreak > 0 ? `Hiện tại đang giữ chuỗi x${stats.currentStreak}` : "Chuỗi trả lời đúng liên tiếp"}
            </span>
          </div>

          {/* Card 2: Total Correct */}
          <div
            className="card-glass"
            style={{
              padding: "1.25rem",
              borderRadius: "16px",
              background: "linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(16, 185, 129, 0.15))",
              border: "1px solid rgba(34, 197, 94, 0.35)",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#22c55e", textTransform: "uppercase" }}>
                Câu Đã Chép Đúng
              </span>
              <span style={{ fontSize: "1.4rem" }}>🎯</span>
            </div>
            <div style={{ fontSize: "2.2rem", fontWeight: 900, color: "#22c55e" }}>
              {stats.totalCorrect}
            </div>
            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
              Trên tổng số {stats.totalAttempts} lượt kiểm tra
            </span>
          </div>

          {/* Card 3: Accuracy */}
          <div
            className="card-glass"
            style={{
              padding: "1.25rem",
              borderRadius: "16px",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--primary-color)", textTransform: "uppercase" }}>
                Độ Chính Xác
              </span>
              <span style={{ fontSize: "1.4rem" }}>🌟</span>
            </div>
            <div style={{ fontSize: "2.2rem", fontWeight: 900, color: "var(--primary-color)" }}>
              {accuracy}%
            </div>
            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
              Tỷ lệ chính xác trung bình
            </span>
          </div>

          {/* Card 4: Lessons Completed */}
          <div
            className="card-glass"
            style={{
              padding: "1.25rem",
              borderRadius: "16px",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-main)", textTransform: "uppercase" }}>
                Bài Học Đã Luyện
              </span>
              <span style={{ fontSize: "1.4rem" }}>📚</span>
            </div>
            <div style={{ fontSize: "2.2rem", fontWeight: 900, color: "var(--text-main)" }}>
              {stats.lessonsPracticed.length}
            </div>
            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
              Bộ đề JLPT đã tham gia
            </span>
          </div>
        </div>

        {/* Mascot Encouragement & Rank Card */}
        <div
          className="card-glass"
          style={{
            padding: "1.5rem",
            borderRadius: "16px",
            marginBottom: "2.5rem",
            display: "flex",
            alignItems: "center",
            gap: "1.25rem",
            background: mascotRank.flame
              ? "linear-gradient(135deg, rgba(249, 115, 22, 0.1), rgba(239, 68, 68, 0.12))"
              : "var(--bg-card)",
            border: mascotRank.flame ? "1px solid rgba(249, 115, 22, 0.35)" : "1px solid var(--border-color)",
          }}
        >
          <div
            style={{
              fontSize: "3.2rem",
              background: "rgba(255, 255, 255, 0.08)",
              width: 72,
              height: 72,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {mascotKey === "kitsune" ? "🦊" : mascotKey === "neko" ? "🐱" : mascotKey === "panda" ? "🐼" : "🐶"}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--text-main)" }}>
                {mascotRank.title}
              </span>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 99,
                  background: "var(--primary-light)",
                  color: "var(--primary-color)",
                }}
              >
                Linh vật đồng hành
              </span>
            </div>
            <p style={{ margin: 0, fontSize: "0.95rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
              {mascotRank.desc}
            </p>
          </div>
        </div>

        {/* Achievement Badges Grid */}
        <div style={{ marginBottom: "2.5rem" }}>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 800, marginBottom: "1rem", display: "flex", alignItems: "center", gap: 8 }}>
            <span>🏅</span>
            <span>Huy Hiệu Thành Tích Đã Mở Khóa</span>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 500 }}>
              ({badges.filter((b) => b.unlocked).length}/{badges.length})
            </span>
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "1rem",
            }}
          >
            {badges.map((b) => (
              <div
                key={b.id}
                className="card-glass"
                style={{
                  padding: "1rem",
                  borderRadius: "14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.85rem",
                  opacity: b.unlocked ? 1 : 0.45,
                  filter: b.unlocked ? "none" : "grayscale(80%)",
                  border: b.unlocked ? "1px solid rgba(250, 204, 21, 0.4)" : "1px solid var(--border-color)",
                  background: b.unlocked
                    ? "linear-gradient(135deg, rgba(250, 204, 21, 0.08), rgba(245, 158, 11, 0.04))"
                    : "rgba(255, 255, 255, 0.02)",
                  transition: "all 0.2s ease",
                }}
              >
                <div
                  style={{
                    fontSize: "2rem",
                    width: 48,
                    height: 48,
                    borderRadius: "12px",
                    background: b.unlocked ? "rgba(250, 204, 21, 0.15)" : "rgba(255, 255, 255, 0.05)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {b.icon}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem", color: b.unlocked ? "var(--text-main)" : "var(--text-muted)" }}>
                    {b.name} {b.unlocked ? "✓" : "🔒"}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 2 }}>
                    {b.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Practice History Table */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <span>📜</span>
              <span>Nhật Ký Luyện Tập Gần Đây</span>
            </h2>
            <Link to="/" className="btn-base btn-primary" style={{ fontSize: "0.85rem", padding: "0.4rem 0.9rem" }}>
              + Luyện bài mới
            </Link>
          </div>

          {history.length === 0 ? (
            <div className="card-glass" style={{ padding: "3rem 1.5rem", textAlign: "center", borderRadius: "16px" }}>
              <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>🎧</div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 0.5rem" }}>
                Chưa có lịch sử làm bài
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", maxWidth: 400, margin: "0 auto 1.25rem" }}>
                Hãy chọn một bài luyện nghe và bắt đầu chép chính tả ngay hôm nay để tích lũy chuỗi thành tích nhé!
              </p>
              <Link to="/" className="btn-base btn-primary">
                Khám phá bài học ngay →
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {history.map((item) => {
                const dateStr = new Date(item.timestamp).toLocaleString("vi-VN", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={item.id}
                    className="card-glass"
                    style={{
                      padding: "1rem 1.25rem",
                      borderRadius: "12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: 800,
                            padding: "1px 6px",
                            borderRadius: "4px",
                            background: "var(--primary-light)",
                            color: "var(--primary-color)",
                          }}
                        >
                          {item.level || "JLPT"}
                        </span>
                        <span style={{ fontWeight: 700, fontSize: "1rem" }}>
                          {item.lessonTitle || item.lessonId}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                        🕒 {dateStr} · {item.correctCount}/{item.totalCount} câu đúng
                        {item.maxStreak > 1 && ` · 🔥 Chuỗi cao nhất: x${item.maxStreak}`}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 800, fontSize: "1.1rem", color: item.score >= 80 ? "#22c55e" : "var(--primary-color)" }}>
                          {item.score}%
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                          Điểm bài làm
                        </div>
                      </div>

                      <Link
                        to={`/lessons/${encodeURIComponent(item.lessonId)}/dictation`}
                        className="btn-base"
                        style={{ fontSize: "0.85rem", padding: "0.4rem 0.85rem" }}
                      >
                        Luyện lại ›
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
