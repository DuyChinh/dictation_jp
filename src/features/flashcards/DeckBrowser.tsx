import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { fmt } from "../../shared/i18n/format";
import { ConfirmDialog } from "../../shared/ui/ConfirmDialog";
import { Icon } from "../../shared/ui/Icon";
import { useFt } from "./flashText";
import { createFolder, deleteFolder, deckStats, folderNameTaken, moveDeck, renameFolder, type DeckStats } from "./store";
import type { Card, Deck, Folder } from "./types";

/** A list longer than this shows the rest behind "Show more", so a big library does not fill the screen. */
export const PAGE_SIZE = 24;
const OPEN_KEY = "jd.flash_folders_open.v1";

function readOpen(): Set<string> {
  try {
    const v = JSON.parse(localStorage.getItem(OPEN_KEY) ?? "[]") as unknown;
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}
function writeOpen(open: Set<string>): void {
  try {
    localStorage.setItem(OPEN_KEY, JSON.stringify([...open]));
  } catch {
    /* the folders just start closed next time */
  }
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });

type Props = {
  /** Every live deck. */
  decks: Deck[];
  /** The decks to show: all of them, or the ones matching what was typed in the search box. */
  shown: Deck[];
  cards: Card[];
  folders: Folder[];
  /** True while something is typed: matching folders are shown opened, then matching decks flat, each saying which folder it is in. */
  searching: boolean;
  /** The folders whose name matches what was typed (only used while searching). */
  matchedFolders?: Folder[];
  onDeleteDeck: (deck: Deck, cardCount: number) => void;
};

/** The deck list: folders (collapsible) with their decks, then the decks that are in no folder. */
export function DeckBrowser({ decks, shown, cards, folders, searching, matchedFolders = [], onDeleteDeck }: Props) {
  const ft = useFt();
  const [open, setOpen] = useState<Set<string>>(readOpen);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [toDelete, setToDelete] = useState<Folder | null>(null);

  const stats = useMemo(() => {
    const byDeck = new Map<string, Card[]>();
    for (const c of cards) {
      const list = byDeck.get(c.deckId);
      if (list) list.push(c);
      else byDeck.set(c.deckId, [c]);
    }
    return new Map(decks.map((d) => [d.id, deckStats(byDeck.get(d.id) ?? [])] as const));
  }, [decks, cards]);

  const folderIds = useMemo(() => new Set(folders.map((f) => f.id)), [folders]);
  /** A deck whose folder was deleted somewhere else counts as being in no folder. */
  const folderOf = (d: Deck): string | undefined => (d.folderId && folderIds.has(d.folderId) ? d.folderId : undefined);
  const sortedFolders = useMemo(() => [...folders].sort(byName), [folders]);
  const nameOf = useMemo(() => new Map(folders.map((f) => [f.id, f.name])), [folders]);

  function toggle(id: string) {
    const next = new Set(open);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setOpen(next);
    writeOpen(next);
  }

  function submitFolder(e: FormEvent) {
    e.preventDefault();
    const folder = createFolder(newName);
    if (!folder) return;
    setNewName("");
    setAdding(false);
    const next = new Set(open).add(folder.id);
    setOpen(next);
    writeOpen(next);
  }

  function submitRename(e: FormEvent) {
    e.preventDefault();
    if (!renaming) return;
    if (renaming.name.trim() && !folderNameTaken(folders, renaming.name, renaming.id)) renameFolder(renaming.id, renaming.name);
    setRenaming(null);
  }

  const taken = folderNameTaken(folders, newName);
  const renameTaken = renaming ? folderNameTaken(folders, renaming.name, renaming.id) : false;

  const grid = (list: Deck[], showFolder: boolean) => (
    <DeckGrid
      decks={list}
      stats={stats}
      folders={sortedFolders}
      folderOf={folderOf}
      nameOf={showFolder ? nameOf : undefined}
      onDelete={onDeleteDeck}
    />
  );

  const toolbar = (
    <div className="fc-folderbar">
      {adding ? (
        <form className="fc-rename" onSubmit={submitFolder}>
          <input
            className="fc-input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={ft("folder.namePlaceholder")}
            aria-label={ft("folder.namePlaceholder")}
            aria-invalid={taken}
            maxLength={80}
            autoFocus
            autoComplete="off"
          />
          <button type="submit" className="btn btn--primary" disabled={!newName.trim() || taken}>{ft("folder.create")}</button>
          <button type="button" className="btn btn--ghost" onClick={() => { setAdding(false); setNewName(""); }}>{ft("common.cancel")}</button>
          {taken && <p className="fc-fielderr" role="alert">{fmt(ft("folder.exists"), { name: newName.trim() })}</p>}
        </form>
      ) : (
        <button type="button" className="btn btn--outline" onClick={() => setAdding(true)}>
          <Icon name="folder" size={18} /> {ft("folder.new")}
        </button>
      )}
    </div>
  );

  const folderSection = (f: Folder, inside: Deck[], forceOpen: boolean) => {
        const isOpen = forceOpen || open.has(f.id);
        const due = inside.reduce((n, d) => n + (stats.get(d.id)?.due ?? 0), 0);
        const editing = renaming?.id === f.id;
        return (
          <section key={f.id} className="fc-folder">
            <div className="fc-folder__head">
              {editing ? (
                <form className="fc-rename fc-folder__rename" onSubmit={submitRename}>
                  <input
                    className="fc-input"
                    value={renaming.name}
                    onChange={(e) => setRenaming({ id: f.id, name: e.target.value })}
                    aria-label={ft("folder.rename")}
                    aria-invalid={renameTaken}
                    maxLength={80}
                    autoFocus
                    autoComplete="off"
                  />
                  <button type="submit" className="btn btn--primary" disabled={!renaming.name.trim() || renameTaken}>{ft("common.save")}</button>
                  <button type="button" className="btn btn--ghost" onClick={() => setRenaming(null)}>{ft("common.cancel")}</button>
                </form>
              ) : (
                <>
                  <button type="button" className="fc-folder__toggle" aria-expanded={isOpen} onClick={() => toggle(f.id)}>
                    <Icon name="chevronRight" size={18} className="fc-folder__chev" />
                    <Icon name="folder" size={20} />
                    <strong className="fc-folder__name">{f.name}</strong>
                    <span className="fc-folder__meta">
                      {fmt(ft("folder.deckCount"), { n: inside.length })}
                      {due > 0 && <span className="fc-deck__due"> · {fmt(ft("page.dueCount"), { n: due })}</span>}
                    </span>
                  </button>
                  <Link to={`/flashcards/create?folder=${encodeURIComponent(f.id)}`} className="fc-folder__btn fc-folder__btn--add" aria-label={fmt(ft("folder.addCardItem"), { name: f.name })} title={ft("folder.addCard")}>
                    <Icon name="plus" size={18} strokeWidth={2.2} />
                  </Link>
                  <button type="button" className="fc-folder__btn" onClick={() => setRenaming({ id: f.id, name: f.name })} aria-label={fmt(ft("folder.renameItem"), { name: f.name })} title={ft("folder.rename")}>
                    <Icon name="pencil" size={16} />
                  </button>
                  <button type="button" className="fc-folder__btn fc-folder__btn--del" onClick={() => setToDelete(f)} aria-label={fmt(ft("folder.deleteItem"), { name: f.name })} title={ft("folder.delete")}>
                    <Icon name="trash" size={16} />
                  </button>
                </>
              )}
            </div>
            {isOpen && (inside.length > 0 ? grid(inside, false) : <p className="fc-note">{ft("folder.empty")}</p>)}
          </section>
        );
  };

  const dialog = toDelete && (
    <ConfirmDialog
      open
      danger
      title={ft("folder.dlg.title")}
      message={fmt(ft("folder.dlg.body"), { name: toDelete.name })}
      confirmLabel={ft("folder.dlg.confirm")}
      cancelLabel={ft("common.cancel")}
      onConfirm={() => {
        deleteFolder(toDelete.id);
        setToDelete(null);
      }}
      onCancel={() => setToDelete(null)}
    />
  );

  if (searching) {
    // Matching folders come first, opened, with all their decks; then the matching decks that are not inside one of them.
    const matched = new Set(matchedFolders.map((f) => f.id));
    const sections = sortedFolders.filter((f) => matched.has(f.id));
    const decksFound = shown.filter((d) => !matched.has(folderOf(d) ?? ""));
    return (
      <>
        {sections.length > 0 && <h2 className="fc-section">{ft("search.folders")}</h2>}
        {sections.map((f) => folderSection(f, decks.filter((d) => folderOf(d) === f.id), true))}
        {sections.length > 0 && decksFound.length > 0 && <h2 className="fc-section">{ft("search.decks")}</h2>}
        {decksFound.length > 0 && grid(decksFound, true)}
        {dialog}
      </>
    );
  }

  const loose = shown.filter((d) => !folderOf(d));

  return (
    <>
      {toolbar}
      {sortedFolders.map((f) => folderSection(f, shown.filter((d) => folderOf(d) === f.id), false))}
      {sortedFolders.length > 0 && loose.length > 0 && <h2 className="fc-section">{ft("folder.loose")}</h2>}
      {loose.length > 0 && grid(loose, false)}
      {dialog}
    </>
  );
}

type GridProps = {
  decks: Deck[];
  stats: Map<string, DeckStats>;
  folders: Folder[];
  folderOf: (d: Deck) => string | undefined;
  /** Given while searching, so each deck names its folder. */
  nameOf?: Map<string, string>;
  onDelete: (deck: Deck, cardCount: number) => void;
};

function DeckGrid({ decks, stats, folders, folderOf, nameOf, onDelete }: GridProps) {
  const ft = useFt();
  const [limit, setLimit] = useState(PAGE_SIZE);
  const visible = decks.slice(0, limit);
  return (
    <>
      <ul className="fc-decks">
        {visible.map((d) => {
          const s = stats.get(d.id) ?? { total: 0, fresh: 0, learning: 0, learned: 0, due: 0 };
          const learnedPct = s.total ? Math.round((s.learned / s.total) * 100) : 0;
          const folderName = nameOf?.get(folderOf(d) ?? "");
          return (
            <li key={d.id} className="fc-decks__item">
              <Link to={`/flashcards/${d.id}`} className="fc-deck">
                <span className="fc-deck__name">{d.name}{d.shareId && <span className="fc-badge fc-badge--inline">{ft("share.badge")}</span>}</span>
                <span className="fc-deck__meta">
                  {fmt(ft("page.cardsCount"), { n: s.total })}
                  {s.due > 0 && <span className="fc-deck__due"> · {fmt(ft("page.dueCount"), { n: s.due })}</span>}
                </span>
                {folderName && <span className="fc-deck__folder"><Icon name="folder" size={13} /> {folderName}</span>}
                <span className="fc-bar" aria-hidden="true"><span style={{ width: `${learnedPct}%` }} /></span>
              </Link>
              {folders.length > 0 && (
                <label className="fc-deck__move" title={ft("folder.move")}>
                  <Icon name="folder" size={16} />
                  <select
                    value={folderOf(d) ?? ""}
                    onChange={(e) => moveDeck(d.id, e.target.value || undefined)}
                    aria-label={fmt(ft("folder.moveItem"), { name: d.name })}
                  >
                    <option value="">{ft("folder.none")}</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </label>
              )}
              <button
                type="button"
                className="fc-deck__del"
                onClick={() => onDelete(d, s.total)}
                aria-label={fmt(ft("deck.deleteItem"), { name: d.name })}
                title={ft("deck.delete")}
              >
                <Icon name="trash" size={16} />
              </button>
            </li>
          );
        })}
      </ul>
      {decks.length > limit && (
        <button type="button" className="btn btn--outline fc-more" onClick={() => setLimit(limit + PAGE_SIZE)}>
          {fmt(ft("page.showMore"), { n: Math.min(PAGE_SIZE, decks.length - limit), rest: decks.length - limit })}
        </button>
      )}
    </>
  );
}
