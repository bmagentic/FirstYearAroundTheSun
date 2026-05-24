import { SaveManager } from '../systems/SaveManager';
import type { SaveProfile } from '../types';

type ProfilePickerOptions = {
  onProfileSelected: (profile: SaveProfile) => void;
};

const MAX_NAME = 16;
const LONG_PRESS_MS = 600;

function timeAgo(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

export class ProfilePicker {
  private root: HTMLElement;
  private opts: ProfilePickerOptions;

  constructor(root: HTMLElement, opts: ProfilePickerOptions) {
    this.root = root;
    this.opts = opts;
  }

  show(): void {
    this.root.classList.remove('hidden');
    this.root.style.display = 'flex';
    this.render();
  }

  hide(): void {
    this.root.classList.add('hidden');
    this.root.style.display = 'none';
    this.root.innerHTML = '';
  }

  private render(): void {
    const profiles = SaveManager.getAllProfiles();
    this.root.innerHTML = '';

    const shell = document.createElement('div');
    shell.className =
      'mx-auto flex h-full w-full max-w-md flex-col items-center justify-center gap-6 px-6 py-10 text-white';

    const title = document.createElement('h1');
    title.className = 'text-3xl font-bold tracking-tight text-amber-200';
    title.textContent = "Caius's First Year";
    shell.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.className = 'text-sm text-amber-100/70';
    subtitle.textContent = 'Choose a player';
    shell.appendChild(subtitle);

    const list = document.createElement('div');
    list.className = 'flex w-full flex-col gap-3';

    if (profiles.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'text-center text-sm text-amber-100/50';
      empty.textContent = 'No players yet. Tap below to begin.';
      list.appendChild(empty);
    } else {
      for (const profile of profiles) {
        list.appendChild(this.profileRow(profile));
      }
    }

    shell.appendChild(list);

    if (SaveManager.canCreateProfile()) {
      shell.appendChild(this.newPlayerButton());
    } else {
      const note = document.createElement('p');
      note.className = 'text-xs text-amber-100/40';
      note.textContent = 'Player limit reached (8). Long-press a row to delete.';
      shell.appendChild(note);
    }

    this.root.appendChild(shell);
  }

  private profileRow(profile: SaveProfile): HTMLElement {
    const row = document.createElement('button');
    row.type = 'button';
    row.className =
      'group relative flex w-full items-center justify-between rounded-2xl border border-amber-300/30 bg-amber-950/40 px-5 py-4 text-left transition active:scale-[0.98] hover:bg-amber-900/40';

    const left = document.createElement('div');
    left.className = 'flex flex-col gap-1';

    const name = document.createElement('span');
    name.className = 'text-lg font-semibold text-amber-100';
    name.textContent = profile.name;
    left.appendChild(name);

    const meta = document.createElement('span');
    meta.className = 'text-xs text-amber-100/60';
    const chaptersDone = profile.completedChapters.length;
    meta.textContent = `${chaptersDone}/12 chapters · ${timeAgo(profile.lastPlayedAt)}`;
    left.appendChild(meta);

    row.appendChild(left);

    const arrow = document.createElement('span');
    arrow.className = 'text-amber-200/60 group-hover:text-amber-200';
    arrow.textContent = '>';
    row.appendChild(arrow);

    let pressTimer: number | null = null;
    let longPressed = false;

    const cancelPress = () => {
      if (pressTimer !== null) {
        window.clearTimeout(pressTimer);
        pressTimer = null;
      }
    };

    row.addEventListener('pointerdown', () => {
      longPressed = false;
      pressTimer = window.setTimeout(() => {
        longPressed = true;
        this.confirmDelete(profile);
      }, LONG_PRESS_MS);
    });
    row.addEventListener('pointerup', cancelPress);
    row.addEventListener('pointerleave', cancelPress);
    row.addEventListener('pointercancel', cancelPress);

    row.addEventListener('click', () => {
      if (longPressed) return;
      const selected = SaveManager.selectProfile(profile.id);
      if (selected) {
        this.hide();
        this.opts.onProfileSelected(selected);
      }
    });

    return row;
  }

  private newPlayerButton(): HTMLElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className =
      'w-full rounded-2xl border-2 border-dashed border-amber-300/40 px-5 py-4 text-amber-200 transition active:scale-[0.98] hover:bg-amber-900/30';
    btn.textContent = '+ New player';
    btn.addEventListener('click', () => this.showNameEntry());
    return btn;
  }

  private showNameEntry(): void {
    this.root.innerHTML = '';
    const shell = document.createElement('div');
    shell.className =
      'mx-auto flex h-full w-full max-w-md flex-col items-center justify-center gap-6 px-6 py-10 text-white';

    const title = document.createElement('h2');
    title.className = 'text-2xl font-bold text-amber-200';
    title.textContent = 'Your name?';
    shell.appendChild(title);

    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = MAX_NAME;
    input.autocapitalize = 'words';
    input.placeholder = 'Mom, Dad, Auntie...';
    input.className =
      'w-full rounded-xl border border-amber-300/30 bg-amber-950/40 px-4 py-3 text-center text-lg text-amber-100 placeholder:text-amber-100/30 focus:outline-none focus:ring-2 focus:ring-amber-300';
    shell.appendChild(input);

    const start = document.createElement('button');
    start.type = 'button';
    start.className =
      'w-full rounded-2xl bg-amber-400 px-5 py-4 text-lg font-bold text-amber-950 transition active:scale-[0.98] disabled:opacity-40';
    start.textContent = 'Begin';
    start.disabled = true;
    shell.appendChild(start);

    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'text-sm text-amber-100/60 underline-offset-4 hover:underline';
    back.textContent = 'Back';
    back.addEventListener('click', () => this.render());
    shell.appendChild(back);

    input.addEventListener('input', () => {
      start.disabled = input.value.trim().length === 0;
    });

    const submit = () => {
      const name = input.value.trim();
      if (!name) return;
      console.log('[picker] creating profile:', name);
      try {
        const profile = SaveManager.createProfile(name);
        console.log('[picker] profile created, hiding picker and notifying scene');
        this.hide();
        this.opts.onProfileSelected(profile);
      } catch (err) {
        console.error('[picker] failed to create profile', err);
      }
    };

    start.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });

    this.root.appendChild(shell);
    setTimeout(() => input.focus(), 50);
  }

  private confirmDelete(profile: SaveProfile): void {
    const ok = window.confirm(`Delete player "${profile.name}"? This cannot be undone.`);
    if (ok) {
      SaveManager.deleteProfile(profile.id);
      this.render();
    }
  }
}
