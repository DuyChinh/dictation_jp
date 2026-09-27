import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "../../shared/ui/Icon";
import { useAdminAuth } from "../AdminAuth";
import { NoAccess, PageHead } from "../AdminLayout";
import {
  adminFetch,
  errorText,
  type FeedbackCategory,
  type FeedbackReplyRow,
  type FeedbackRow,
  type FeedbackStatus,
  type Paged,
} from "../api";
import {
  BulkBar,
  DataTable,
  Pagination,
  RowAction,
  StatusBadge,
  useSelection,
  type Column,
  type Tone,
} from "../components/DataTable";
import { useFeedback } from "../components/Feedback";
import { Field, FormDialog } from "../components/Modal";
import { useAsync, useDebounced } from "../hooks";
import { dateTimeText, initials, num, relativeText } from "../format";
import { AttachmentStrip, ComposerTools, insertAtCaret, VideoLinksEditor } from "../../features/feedback/FeedbackParts";
import { useAttachments } from "../../features/feedback/useAttachments";
import { useVideoLinks, type VideoLinks } from "../../features/feedback/useVideoLinks";
import type { FeedbackVideo } from "../../features/feedback/videoLinks";

const MAX_IMAGES = 4;

function uploadTeamImage(image: string) {
  return adminFetch<{ url: string }>("/feedback/images", { method: "POST", body: { image } });
}

/** Cloudinary's per-file cap for videos on the free plan. */
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

type SignedUpload = {
  uploadUrl: string;
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  publicId: string;
};

/** Sends the file straight from the browser to Cloudinary with a signature from our server. */
async function uploadTeamVideo(file: File, onProgress: (share: number) => void): Promise<FeedbackVideo> {
  const s = await adminFetch<SignedUpload>("/feedback/video-upload", { method: "POST" });
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", s.uploadUrl);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      let body: { public_id?: string; error?: { message?: string } } = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* not JSON */
      }
      if (xhr.status >= 200 && xhr.status < 300 && body.public_id) {
        const base = `https://res.cloudinary.com/${s.cloudName}/video/upload`;
        resolve({
          provider: "cloudinary",
          id: body.public_id,
          url: `${base}/q_auto/${body.public_id}.mp4`,
          poster: `${base}/so_1,q_auto/${body.public_id}.jpg`,
        });
      } else {
        reject(new Error(body.error?.message || `HTTP ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("Không kết nối được Cloudinary."));
    const form = new FormData();
    form.append("file", file);
    form.append("api_key", s.apiKey);
    form.append("timestamp", String(s.timestamp));
    form.append("signature", s.signature);
    form.append("folder", s.folder);
    form.append("public_id", s.publicId);
    xhr.send(form);
  });
}

/** "Upload a video" with a progress bar; the finished video joins the post's list. */
function VideoUploadButton({ video, onBusy }: { video: VideoLinks; onBusy: (busy: boolean) => void }) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const pick = async (file: File) => {
    setError(null);
    if (!file.type.startsWith("video/")) {
      setError("Hãy chọn một tệp video (mp4, mov, webm…).");
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setError(`Video nặng ${(file.size / 1048576).toFixed(0)}MB, vượt giới hạn 100MB. Hãy cắt ngắn hoặc dùng link YouTube.`);
      return;
    }
    setProgress(0);
    onBusy(true);
    try {
      const v = await uploadTeamVideo(file, setProgress);
      if (video.push(v)) setError("Bài đã đủ 2 video.");
    } catch (err) {
      setError(`Tải video lên thất bại: ${err instanceof Error ? err.message : "lỗi không rõ"}`);
    } finally {
      setProgress(null);
      onBusy(false);
    }
  };

  return (
    <div className="adm-fb-upload">
      <button
        type="button"
        className="btn btn--outline btn--sm"
        onClick={() => input.current?.click()}
        disabled={progress !== null || video.full}
        title={video.full ? "Bài đã đủ 2 video" : undefined}
      >
        <Icon name="video" size={16} />
        {progress !== null ? `Đang tải lên ${Math.round(progress * 100)}%` : "Tải video từ máy"}
      </button>
      <input
        ref={input}
        type="file"
        accept="video/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void pick(file);
        }}
      />
      {progress !== null && (
        <div className="progress adm-fb-upload__bar">
          <span style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
      {error && <span className="adm-fb-upload__error">{error}</span>}
    </div>
  );
}

type FeedbackResponse = Paged<FeedbackRow> & {
  summary: { total: number; open: number; unanswered: number; hidden: number };
};

const CATEGORY_LABEL: Record<FeedbackCategory, string> = {
  idea: "Ý tưởng",
  bug: "Báo lỗi",
  content: "Nội dung & đề thi",
  other: "Khác",
};

const CATEGORY_ICON: Record<FeedbackCategory, IconName> = {
  idea: "bulb",
  bug: "bug",
  content: "book",
  other: "message",
};

const STATUS_LABEL: Record<FeedbackStatus, string> = {
  open: "Đã tiếp nhận",
  planned: "Đang thực hiện",
  done: "Đã hoàn thành",
};

const STATUS_TONE: Record<FeedbackStatus, Tone> = { open: "neutral", planned: "warn", done: "ok" };

type Form = {
  category: FeedbackCategory;
  body: string;
  status: FeedbackStatus;
  adminReply: string;
  pinned: boolean;
  hidden: boolean;
};

const EMPTY_FORM: Form = { category: "other", body: "", status: "open", adminReply: "", pinned: true, hidden: false };

/** Replies under a post, each removable by a moderator. */
function RepliesPanel({ feedbackId, canWrite, onRemoved }: { feedbackId: string; canWrite: boolean; onRemoved: () => void }) {
  const { confirm, toast } = useFeedback();
  const { data, error, loading, reload } = useAsync(
    () => adminFetch<{ items: FeedbackReplyRow[] }>(`/feedback/${feedbackId}/replies`),
    [feedbackId],
  );

  const remove = async (r: FeedbackReplyRow) => {
    const ok = await confirm({
      title: "Xoá câu trả lời?",
      body: (
        <p>
          Câu trả lời của <strong>{r.authorName || "người dùng đã xoá"}</strong>
          {r.parentId ? "" : " cùng các câu trả lời bên dưới nó"} sẽ bị xoá vĩnh viễn.
        </p>
      ),
      confirmLabel: "Xoá câu trả lời",
      danger: true,
    });
    if (!ok) return;
    try {
      await adminFetch(`/feedback/replies/${r.id}`, { method: "DELETE" });
      toast("Đã xoá câu trả lời");
      void reload();
      onRemoved();
    } catch (err) {
      toast(errorText(err), "error");
    }
  };

  if (error) return <div className="alert">{error}</div>;
  if (loading && !data) return <p className="muted">Đang tải…</p>;
  const all = data?.items ?? [];
  if (!all.length) return <p className="muted">Chưa có câu trả lời nào.</p>;
  // Each top-level reply followed by the replies under it, as learners see them.
  const ids = new Set(all.map((r) => r.id));
  const roots = all.filter((r) => !r.parentId || !ids.has(r.parentId));
  const items = roots.flatMap((root) => [root, ...all.filter((r) => r.parentId === root.id)]);

  return (
    <ul className="adm-fb-replies">
      {items.map((r) => (
        <li key={r.id} className={r.parentId && ids.has(r.parentId) ? "is-nested" : undefined}>
          <span className="adm-avatar" aria-hidden="true">
            {r.authorAvatar ? <img src={r.authorAvatar} alt="" /> : initials(r.authorName || "?")}
          </span>
          <div className="adm-fb-replies__main">
            <span className="adm-fb-replies__who">
              <strong>{r.authorName || "Người dùng đã xoá"}</strong>
              <span className="muted">
                {r.authorEmail} · {relativeText(r.createdAt)}
                {r.editedAt ? " · đã sửa" : ""}
              </span>
            </span>
            {r.body && <p>{r.body}</p>}
            {r.images.length > 0 && <ImageThumbs images={r.images} />}
            {r.reactions.length > 0 && (
              <span className="adm-fb-reacts">{r.reactions.map((x) => `${x.emoji} ${x.count}`).join("  ")}</span>
            )}
          </div>
          {canWrite && <RowAction icon="trash" label="Xoá câu trả lời" onClick={() => remove(r)} danger />}
        </li>
      ))}
    </ul>
  );
}

function ImageThumbs({ images }: { images: string[] }) {
  return (
    <div className="adm-fb-thumbs">
      {images.map((src) => (
        <a key={src} href={src} target="_blank" rel="noreferrer" title="Mở ảnh gốc">
          <img src={src} alt="" loading="lazy" />
        </a>
      ))}
    </div>
  );
}

/** `item` null opens the dialog for a new post from the team. */
function FeedbackDialog({
  open,
  item,
  canWrite,
  onClose,
  onSaved,
  onRepliesChanged,
}: {
  open: boolean;
  item: FeedbackRow | null;
  canWrite: boolean;
  onClose: () => void;
  onSaved: (created: boolean) => void;
  onRepliesChanged: () => void;
}) {
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attachments = useAttachments(MAX_IMAGES, [], uploadTeamImage);
  const video = useVideoLinks();
  const [videoUploading, setVideoUploading] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    attachments.reset(item?.images ?? []);
    video.reset(item?.videos ?? []);
    setForm(
      item
        ? {
            category: item.category,
            body: item.body,
            status: item.status,
            adminReply: item.adminReply,
            pinned: item.pinned,
            hidden: item.hidden,
          }
        : EMPTY_FORM,
    );
    setError(null);
  }, [open, item]);

  const set =
    <K extends keyof Form>(k: K) =>
    (e: { target: { value: string } }) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));
  const setFlag = (k: "pinned" | "hidden") => (e: { target: { checked: boolean } }) =>
    setForm((f) => ({ ...f, [k]: e.target.checked }));

  const submit = async () => {
    if (attachments.uploading || videoUploading) {
      setError("Ảnh hoặc video vẫn đang tải lên, chờ một chút rồi lưu lại.");
      return;
    }
    setBusy(true);
    try {
      const body = { ...form, images: attachments.urls, videos: video.videos };
      if (item) {
        await adminFetch(`/feedback/${item.id}`, { method: "PATCH", body });
      } else {
        await adminFetch("/feedback", { method: "POST", body });
      }
      onSaved(!item);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const fromUser = item !== null && !item.fromTeam;

  return (
    <FormDialog
      open={open}
      title={item ? (fromUser ? "Phản hồi góp ý" : "Sửa bài của đội ngũ") : "Viết bài của đội ngũ"}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={item ? "Lưu" : "Đăng bài"}
      busy={busy}
      error={error}
    >
      {fromUser && (
        <p className="adm-fb-from">
          <strong>{item.authorName || "Người dùng đã xoá"}</strong>
          {item.authorEmail && <span className="muted"> · {item.authorEmail}</span>}
          <span className="muted"> · {dateTimeText(item.createdAt)}</span>
        </p>
      )}
      <div className="adm-form__row">
        <Field label="Loại" htmlFor="fb-cat">
          <select id="fb-cat" value={form.category} onChange={set("category")}>
            {(Object.keys(CATEGORY_LABEL) as FeedbackCategory[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Trạng thái" htmlFor="fb-status" hint="Người dùng thấy trạng thái này trên bảng góp ý.">
          <select id="fb-status" value={form.status} onChange={set("status")}>
            {(Object.keys(STATUS_LABEL) as FeedbackStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field
        label="Nội dung"
        htmlFor="fb-body"
        hint={fromUser ? "Chỉ sửa khi cần, ví dụ để xoá thông tin cá nhân hoặc lời lẽ không phù hợp." : undefined}
      >
        <textarea
          ref={bodyRef}
          id="fb-body"
          rows={5}
          required
          maxLength={1000}
          value={form.body}
          onChange={set("body")}
        />
      </Field>
      <div className="adm-field">
        <span className="adm-field__label">
          Ảnh & video <span className="muted">({attachments.items.length}/{MAX_IMAGES} ảnh · {video.videos.length}/2 video)</span>
        </span>
        <AttachmentStrip attachments={attachments} />
        <VideoLinksEditor video={video} />
        <VideoUploadButton video={video} onBusy={setVideoUploading} />
        <div className="adm-fb-tools">
          <ComposerTools
            attachments={attachments}
            video={video}
            onEmoji={(emoji) =>
              insertAtCaret(bodyRef.current, form.body, emoji, (v) => setForm((f) => ({ ...f, body: v })), 1000)
            }
          />
          <span className="adm-field__hint">
            {fromUser
              ? "Gỡ ảnh hoặc video không phù hợp bằng dấu ✕. Ảnh bị gỡ sẽ bị xoá khi lưu."
              : "Tối đa 4 ảnh (tự thu nhỏ) và 2 video: tải từ máy (≤ 100MB) hoặc dán link YouTube / Google Drive."}
          </span>
        </div>
      </div>
      <Field label="Phản hồi từ Motto" htmlFor="fb-reply" hint="Hiện ngay dưới góp ý. Để trống nếu chưa phản hồi.">
        <textarea
          id="fb-reply"
          rows={4}
          maxLength={1000}
          value={form.adminReply}
          onChange={set("adminReply")}
          placeholder="Cảm ơn bạn! Chúng tôi đã…"
        />
      </Field>
      <div className="adm-form__row">
        <label className="adm-toggle">
          <input type="checkbox" checked={form.pinned} onChange={setFlag("pinned")} />
          Ghim lên đầu bảng
        </label>
        <label className="adm-toggle">
          <input type="checkbox" checked={form.hidden} onChange={setFlag("hidden")} />
          Ẩn khỏi bảng công khai
        </label>
      </div>
      {item && (
        <section className="adm-fb-thread">
          <h3 className="adm-subhead">Thảo luận</h3>
          <RepliesPanel feedbackId={item.id} canWrite={canWrite} onRemoved={onRepliesChanged} />
        </section>
      )}
    </FormDialog>
  );
}

export function FeedbackAdminPage() {
  const { can } = useAdminAuth();
  const { confirm, toast } = useFeedback();
  const canWrite = can("feedback", "write");

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [visibility, setVisibility] = useState("");
  const [page, setPage] = useState(1);
  const query = useDebounced(q);

  useEffect(() => setPage(1), [query, status, category, visibility]);

  const { data, error, loading, reload } = useAsync(
    () =>
      adminFetch<FeedbackResponse>("/feedback", { query: { q: query, status, category, visibility, page, limit: 20 } }).then(
        (d) => ({
          ...d,
          // An older server doesn't send these yet.
          items: d.items.map((f) => ({
            ...f,
            images: f.images ?? [],
            videos: f.videos ?? [],
            reactions: f.reactions ?? [],
            replyCount: f.replyCount ?? 0,
          })),
        }),
      ),
    [query, status, category, visibility, page],
  );
  const rows = data?.items ?? [];
  const selection = useSelection(rows.map((r) => r.id));
  const [dialog, setDialog] = useState<{ item: FeedbackRow | null } | null>(null);

  if (!can("feedback", "read")) return <NoAccess />;

  const patch = async (f: FeedbackRow, body: Partial<Pick<FeedbackRow, "hidden" | "pinned">>, done: string) => {
    try {
      await adminFetch(`/feedback/${f.id}`, { method: "PATCH", body });
      toast(done);
      void reload();
    } catch (err) {
      toast(errorText(err), "error");
    }
  };

  const removeOne = async (f: FeedbackRow) => {
    const ok = await confirm({
      title: "Xoá góp ý?",
      body: <p>Góp ý này và phản hồi đi kèm sẽ bị xoá vĩnh viễn. Nếu chỉ muốn gỡ khỏi bảng công khai, hãy dùng Ẩn.</p>,
      confirmLabel: "Xoá góp ý",
      danger: true,
    });
    if (!ok) return;
    try {
      await adminFetch(`/feedback/${f.id}`, { method: "DELETE" });
      toast("Đã xoá góp ý");
      void reload();
    } catch (err) {
      toast(errorText(err), "error");
    }
  };

  const removeSelected = async () => {
    const ids = [...selection.selected];
    const ok = await confirm({
      title: `Xoá ${ids.length} góp ý?`,
      body: <p>Các góp ý đã chọn sẽ bị xoá vĩnh viễn. Không thể hoàn tác.</p>,
      confirmLabel: `Xoá ${ids.length} góp ý`,
      danger: true,
    });
    if (!ok) return;
    try {
      const d = await adminFetch<{ deleted: number }>("/feedback/bulk-delete", { method: "POST", body: { ids } });
      toast(`Đã xoá ${d.deleted} góp ý`);
      selection.clear();
      void reload();
    } catch (err) {
      toast(errorText(err), "error");
    }
  };

  const columns: Column<FeedbackRow>[] = [
    {
      key: "author",
      header: "Người gửi",
      cell: (f) =>
        f.fromTeam ? (
          <span className="adm-user">
            <span className="adm-avatar" aria-hidden="true">
              <img src="/logo.png" alt="" />
            </span>
            <span className="adm-user__text">
              <strong>Đội ngũ Motto</strong>
              <span>bởi {f.authorName}</span>
            </span>
          </span>
        ) : (
          <span className="adm-user">
            <span className="adm-avatar" aria-hidden="true">
              {f.authorAvatar ? <img src={f.authorAvatar} alt="" /> : initials(f.authorName || "?")}
            </span>
            <span className="adm-user__text">
              <strong>{f.authorName || "Người dùng đã xoá"}</strong>
              <span>{f.authorEmail || "—"}</span>
            </span>
          </span>
        ),
    },
    {
      key: "body",
      header: "Nội dung",
      cell: (f) => (
        <div className="adm-fb-body">
          <span className={`adm-fb-cat adm-fb-cat--${f.category}`}>
            <Icon name={CATEGORY_ICON[f.category]} size={13} strokeWidth={2.2} />
            {CATEGORY_LABEL[f.category]}
          </span>
          <p title={f.body}>{f.body}</p>
          {(f.images.length > 0 || f.videos.length > 0 || f.reactions.length > 0) && (
            <span className="adm-fb-extras">
              {f.images.length > 0 && (
                <span>
                  <Icon name="image" size={13} /> {f.images.length} ảnh
                </span>
              )}
              {f.videos.length > 0 && (
                <span>
                  <Icon name="video" size={13} /> {f.videos.length} video
                </span>
              )}
              {f.reactions.length > 0 && <span>{f.reactions.map((x) => `${x.emoji}${x.count}`).join(" ")}</span>}
            </span>
          )}
          {f.adminReply ? (
            <span className="adm-fb-replied">
              <Icon name="check" size={13} strokeWidth={2.4} />
              Đã phản hồi
            </span>
          ) : (
            !f.fromTeam && <span className="adm-fb-waiting">Chưa phản hồi</span>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (f) => (
        <span className="adm-stack">
          <StatusBadge tone={STATUS_TONE[f.status]}>{STATUS_LABEL[f.status]}</StatusBadge>
          {f.pinned && (
            <StatusBadge tone="info" icon="pin">
              Đã ghim
            </StatusBadge>
          )}
          {f.hidden && (
            <StatusBadge tone="bad" icon="eyeOff">
              Đang ẩn
            </StatusBadge>
          )}
        </span>
      ),
    },
    { key: "likes", header: "Ủng hộ", align: "right", cell: (f) => num(f.likes) },
    { key: "replies", header: "Trả lời", align: "right", cell: (f) => num(f.replyCount) },
    {
      key: "created",
      header: "Gửi lúc",
      cell: (f) => (
        <span className="adm-stack">
          <span title={dateTimeText(f.createdAt)}>{relativeText(f.createdAt)}</span>
          {f.editedAt && <span className="adm-sub">Sửa {relativeText(f.editedAt).toLowerCase()}</span>}
        </span>
      ),
    },
  ];

  const summary = data?.summary;

  return (
    <>
      <PageHead
        title="Góp ý"
        sub={
          summary
            ? `${num(summary.total)} góp ý · ${num(summary.unanswered)} chưa phản hồi · ${num(summary.open)} mới tiếp nhận · ${num(summary.hidden)} đang ẩn`
            : undefined
        }
      >
        {canWrite && (
          <button type="button" className="btn btn--primary" onClick={() => setDialog({ item: null })}>
            <Icon name="plus" size={18} />
            Viết bài của đội ngũ
          </button>
        )}
      </PageHead>

      <div className="adm-filters">
        <label className="lesson-search adm-search">
          <Icon name="search" size={18} />
          <span className="visually-hidden">Tìm góp ý</span>
          <input
            type="search"
            placeholder="Tìm trong nội dung hoặc phản hồi"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoComplete="off"
          />
        </label>
        <label className="adm-select">
          <span>Trạng thái</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tất cả</option>
            {(Object.keys(STATUS_LABEL) as FeedbackStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="adm-select">
          <span>Loại</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Tất cả</option>
            {(Object.keys(CATEGORY_LABEL) as FeedbackCategory[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="adm-select">
          <span>Hiển thị</span>
          <select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
            <option value="">Tất cả</option>
            <option value="visible">Đang hiện</option>
            <option value="hidden">Đang ẩn</option>
            <option value="pinned">Đã ghim</option>
          </select>
        </label>
      </div>

      {error && <div className="notice notice--error adm-gap">{error}</div>}

      <section className="panel table-card">
        {canWrite && (
          <BulkBar count={selection.selected.size} noun="góp ý" onClear={selection.clear}>
            <button type="button" className="btn btn--sm adm-btn--danger" onClick={removeSelected}>
              Xoá đã chọn
            </button>
          </BulkBar>
        )}
        <DataTable
          caption="Danh sách góp ý"
          rows={rows}
          columns={columns}
          rowKey={(f) => f.id}
          rowLabel={(f) => f.body.slice(0, 40)}
          selection={canWrite ? selection : undefined}
          loading={loading}
          empty="Chưa có góp ý nào khớp bộ lọc."
          actions={
            canWrite
              ? (f) => (
              <>
                <RowAction
                  icon={f.fromTeam ? "pencil" : "message"}
                  label={f.fromTeam ? "Sửa bài" : "Phản hồi / sửa"}
                  onClick={() => setDialog({ item: f })}
                />
                <RowAction
                  icon="pin"
                  label={f.pinned ? "Bỏ ghim" : "Ghim lên đầu"}
                  onClick={() => patch(f, { pinned: !f.pinned }, f.pinned ? "Đã bỏ ghim" : "Đã ghim lên đầu bảng")}
                />
                <RowAction
                  icon={f.hidden ? "eye" : "eyeOff"}
                  label={f.hidden ? "Hiện lại" : "Ẩn khỏi bảng công khai"}
                  onClick={() => patch(f, { hidden: !f.hidden }, f.hidden ? "Đã hiện lại góp ý" : "Đã ẩn góp ý")}
                />
                <RowAction icon="trash" label="Xoá góp ý" onClick={() => removeOne(f)} danger />
              </>
                )
              : undefined
          }
        />
        {data && <Pagination page={data.page} limit={data.limit} total={data.total} onPage={setPage} />}
      </section>

      <FeedbackDialog
        open={dialog !== null}
        item={dialog?.item ?? null}
        canWrite={canWrite}
        onRepliesChanged={() => void reload()}
        onClose={() => setDialog(null)}
        onSaved={(created) => {
          setDialog(null);
          toast(created ? "Đã đăng bài lên bảng góp ý" : "Đã lưu góp ý");
          void reload();
        }}
      />
    </>
  );
}
