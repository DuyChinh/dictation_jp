import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../shared/ui/AppShell";
import { Icon } from "../shared/ui/Icon";
import { useUiLanguage } from "../shared/i18n/UiLanguageContext";
import type { UiLang } from "../shared/i18n/translations";
import { useAuth } from "../features/auth/AuthContext";
import { UserAvatar, planLabel } from "../features/auth/LoginButton";
import { AvatarImageError, toAvatarDataUrl } from "../features/auth/avatarImage";

function joinedLabel(iso: string, lang: UiLang): string {
  return new Date(iso).toLocaleDateString(lang === "ja" ? "ja-JP" : lang === "en" ? "en-GB" : "vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

type Status = { kind: "ok" | "error"; text: string } | null;

function StatusLine({ status }: { status: Status }) {
  if (!status) return null;
  return (
    <div className={`alert${status.kind === "ok" ? " alert--ok" : ""}`} role={status.kind === "ok" ? "status" : "alert"}>
      {status.text}
    </div>
  );
}

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

function AvatarEditor() {
  const { user, updateAvatar, removeAvatar } = useAuth();
  const { t } = useUiLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  if (!user) return null;

  const run = async (action: () => Promise<void>, done: string) => {
    setBusy(true);
    setStatus(null);
    try {
      await action();
      setStatus({ kind: "ok", text: done });
    } catch (err) {
      const text =
        err instanceof AvatarImageError
          ? t(err.reason === "size" ? "profile.avatarTooBig" : "profile.avatarBadFile")
          : errorText(err, t("auth.error"));
      setStatus({ kind: "error", text });
    } finally {
      setBusy(false);
    }
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Clear it so picking the same file again still fires a change.
    e.target.value = "";
    if (!file) return;
    run(async () => updateAvatar(await toAvatarDataUrl(file)), t("profile.avatarSaved"));
  };

  return (
    <div className="profile__avatar-edit">
      <button
        type="button"
        className="profile__avatar-btn"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-label={t("profile.avatarChange")}
        title={t("profile.avatarChange")}
      >
        <UserAvatar user={user} className="account__avatar profile__avatar" />
        <span className="profile__avatar-badge" aria-hidden="true">
          <Icon name="camera" size={16} />
        </span>
      </button>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={onPick} />
      <div className="profile__avatar-links">
        <button type="button" className="link-btn" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? t("auth.wait") : t("profile.avatarChange")}
        </button>
        {user.avatar && !busy && (
          <button
            type="button"
            className="link-btn profile__avatar-remove"
            onClick={() => run(removeAvatar, t("profile.avatarRemoved"))}
          >
            {t("profile.avatarRemove")}
          </button>
        )}
      </div>
      <StatusLine status={status} />
    </div>
  );
}

function NameForm() {
  const { user, updateProfile } = useAuth();
  const { t } = useUiLanguage();
  const [name, setName] = useState(user?.displayName ?? "");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  useEffect(() => {
    setName(user?.displayName ?? "");
  }, [user?.displayName]);

  const trimmed = name.trim();
  const unchanged = trimmed === user?.displayName;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      await updateProfile(trimmed);
      setStatus({ kind: "ok", text: t("profile.saved") });
    } catch (err) {
      setStatus({ kind: "error", text: errorText(err, t("auth.error")) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="panel card-pad">
      <h2>{t("profile.info")}</h2>
      <StatusLine status={status} />
      <form className="profile__form" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="profile-name">{t("auth.displayName")}</label>
          <input
            id="profile-name"
            type="text"
            required
            maxLength={60}
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("auth.displayNamePh")}
          />
        </div>
        <div className="field">
          <label htmlFor="profile-email">{t("auth.email")}</label>
          <input id="profile-email" type="email" value={user?.email ?? ""} readOnly disabled />
        </div>
        <div className="profile__actions">
          <button type="submit" className="btn btn--primary" disabled={saving || !trimmed || unchanged}>
            {saving ? t("auth.wait") : t("profile.save")}
          </button>
        </div>
      </form>
    </section>
  );
}

function PasswordForm() {
  const { user, changePassword } = useAuth();
  const { t } = useUiLanguage();
  const hasPassword = user?.hasPassword ?? true;
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== confirm) {
      setStatus({ kind: "error", text: t("auth.passwordMismatch") });
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      await changePassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      setStatus({ kind: "ok", text: t("profile.passwordChanged") });
    } catch (err) {
      setStatus({ kind: "error", text: errorText(err, t("auth.error")) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="panel card-pad">
      <div>
        <h2>{hasPassword ? t("profile.changePassword") : t("profile.setPassword")}</h2>
        {!hasPassword && <p className="profile__hint">{t("profile.setPasswordHint")}</p>}
      </div>
      <StatusLine status={status} />
      <form className="profile__form" onSubmit={onSubmit}>
        {hasPassword && (
          <div className="field">
            <label htmlFor="profile-current">{t("profile.currentPassword")}</label>
            <input
              id="profile-current"
              type="password"
              required
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </div>
        )}
        <div className="field">
          <label htmlFor="profile-new">{t("auth.newPassword")}</label>
          <input
            id="profile-new"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder={t("auth.passwordPh")}
          />
        </div>
        <div className="field">
          <label htmlFor="profile-confirm">{t("auth.confirmPassword")}</label>
          <input
            id="profile-confirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <div className="profile__actions">
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? t("auth.wait") : hasPassword ? t("profile.changePassword") : t("profile.setPassword")}
          </button>
        </div>
      </form>
    </section>
  );
}

export function ProfilePage() {
  const { user, loading, logout } = useAuth();
  const { t, uiLang } = useUiLanguage();

  return (
    <AppShell title={t("profile.title")}>
      <div className="page-head">
        <div>
          <h1>{t("profile.title")}</h1>
          <p>{t("profile.sub")}</p>
        </div>
      </div>

      {loading ? null : !user ? (
        <div className="notice">
          <Icon name="lock" />
          <span>{t("profile.signedOut")}</span>
          <Link to="/auth" className="btn btn--primary btn--sm" style={{ marginLeft: "auto" }}>
            {t("auth.login")}
          </Link>
        </div>
      ) : (
        <div className="profile">
          <aside className="panel card-pad profile__card">
            <AvatarEditor />
            <div className="profile__who">
              <span className="profile__name">{user.displayName}</span>
              <span className="profile__email">{user.email}</span>
            </div>
            <dl className="profile__facts">
              <div>
                <dt>{t("profile.signIn")}</dt>
                <dd>{user.authProvider === "google" ? "Google" : t("auth.email")}</dd>
              </div>
              <div>
                <dt>{t("profile.plan")}</dt>
                <dd>
                  <span className="badge badge--sm">
                    {planLabel(user.plan, t("pricing.free"))}
                  </span>
                </dd>
              </div>
              {user.createdAt && (
                <div>
                  <dt>{t("profile.joined")}</dt>
                  <dd>{joinedLabel(user.createdAt, uiLang)}</dd>
                </div>
              )}
            </dl>
            <button type="button" className="btn btn--outline btn--block" onClick={logout}>
              <Icon name="logout" size={18} />
              {t("auth.logout")}
            </button>
          </aside>

          <div className="profile__main">
            <NameForm />
            <PasswordForm />
          </div>
        </div>
      )}
    </AppShell>
  );
}
