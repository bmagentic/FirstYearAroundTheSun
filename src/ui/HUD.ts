import { SettingsManager } from '../systems/Settings';

export type HUDCallbacks = {
  getActiveSceneKey: () => string | null;
  onPauseRequested: () => void;
  onResumeRequested: () => void;
  onRestartRequested: () => void;
  onExitRequested: () => void;
  onHomeRequested: () => void;
  onMuteChange: (muted: boolean) => void;
};

const MUTED_GLYPH = '\u{1F507}'; // 🔇
const UNMUTED_GLYPH = '\u{1F50A}'; // 🔊

// Pause is available everywhere except the boot/title, sound notice, and profile
// screens — so the player can quit Home from mid-chapter as well as the overworld.
const NON_PAUSABLE_SCENES = new Set(['BootScene', 'SoundNoticeScene', 'MenuScene']);

export class HUD {
  private muteBtn: HTMLButtonElement;
  private pauseBtn: HTMLButtonElement;
  private pauseMenu: HTMLElement;
  private callbacks: HUDCallbacks;
  private menuOpen = false;

  constructor(root: HTMLElement, pauseMenu: HTMLElement, callbacks: HUDCallbacks) {
    this.callbacks = callbacks;
    this.pauseMenu = pauseMenu;

    root.innerHTML = '';
    root.className = 'pointer-events-none fixed top-3 right-3 z-30 flex items-center gap-2';

    this.muteBtn = this.makeIconButton(this.muteGlyph());
    this.muteBtn.addEventListener('click', () => this.toggleMute());

    this.pauseBtn = this.makeIconButton('⏸');
    this.pauseBtn.addEventListener('click', () => this.requestPause());

    root.appendChild(this.muteBtn);
    root.appendChild(this.pauseBtn);
  }

  private makeIconButton(label: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className =
      'pointer-events-auto h-10 w-10 rounded-full bg-black/55 text-lg text-amber-100 backdrop-blur transition active:scale-95 hover:bg-black/75';
    btn.textContent = label;
    return btn;
  }

  private muteGlyph(): string {
    return SettingsManager.get().muted ? MUTED_GLYPH : UNMUTED_GLYPH;
  }

  private toggleMute(): void {
    const next = !SettingsManager.get().muted;
    SettingsManager.setMuted(next);
    this.muteBtn.textContent = this.muteGlyph();
    this.callbacks.onMuteChange(next);
  }

  private requestPause(): void {
    if (this.menuOpen) return;
    const sceneKey = this.callbacks.getActiveSceneKey();
    if (!sceneKey || NON_PAUSABLE_SCENES.has(sceneKey)) return;

    this.menuOpen = true;
    this.callbacks.onPauseRequested();
    this.renderPauseMenu(sceneKey);
  }

  private renderPauseMenu(sceneKey: string): void {
    this.pauseMenu.innerHTML = '';
    this.pauseMenu.classList.remove('hidden');
    this.pauseMenu.className =
      'fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-6';

    const shell = document.createElement('div');
    shell.className =
      'mx-auto flex w-full max-w-xs flex-col gap-4 rounded-3xl border border-amber-300/30 bg-amber-950/95 px-6 py-8 text-center text-amber-100 shadow-2xl';

    const title = document.createElement('h2');
    title.className = 'text-xl font-bold text-amber-200';
    title.textContent = 'Paused';
    shell.appendChild(title);

    const resume = this.menuButton('Resume', 'primary');
    resume.addEventListener('click', () => {
      this.closeMenu();
      this.callbacks.onResumeRequested();
    });
    shell.appendChild(resume);

    if (sceneKey !== 'HouseScene') {
      const restart = this.menuButton('Restart');
      restart.addEventListener('click', () => {
        this.closeMenu();
        this.callbacks.onRestartRequested();
      });
      shell.appendChild(restart);

      const exit = this.menuButton('Exit to House');
      exit.addEventListener('click', () => {
        this.closeMenu();
        this.callbacks.onExitRequested();
      });
      shell.appendChild(exit);
    }

    const home = this.menuButton('Home (save & quit)');
    home.addEventListener('click', () => {
      this.closeMenu();
      this.callbacks.onHomeRequested();
    });
    shell.appendChild(home);

    this.pauseMenu.appendChild(shell);
  }

  private menuButton(label: string, variant: 'primary' | 'default' = 'default'): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.className =
      variant === 'primary'
        ? 'rounded-2xl bg-amber-400 px-4 py-3 text-lg font-bold text-amber-950 transition active:scale-[0.98]'
        : 'rounded-2xl border border-amber-300/30 px-4 py-3 text-base text-amber-100 transition active:scale-[0.98] hover:bg-amber-900/40';
    return btn;
  }

  private closeMenu(): void {
    this.menuOpen = false;
    this.pauseMenu.classList.add('hidden');
    this.pauseMenu.innerHTML = '';
  }

  refreshMute(): void {
    this.muteBtn.textContent = this.muteGlyph();
  }
}
