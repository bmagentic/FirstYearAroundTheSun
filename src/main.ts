import Phaser from 'phaser';
import './styles.css';
import { BootScene } from './scenes/BootScene';
import { SoundNoticeScene } from './scenes/SoundNoticeScene';
import { MenuScene } from './scenes/MenuScene';
import { HouseScene } from './scenes/HouseScene';
import { Ch01_Arrival } from './scenes/chapters/Ch01_Arrival';
import { Ch02_FirstSmile } from './scenes/chapters/Ch02_FirstSmile';
import { Ch03_EyesOpen } from './scenes/chapters/Ch03_EyesOpen';
import { Ch04_RollOut } from './scenes/chapters/Ch04_RollOut';
import { Ch05_HoliDadInn } from './scenes/chapters/Ch05_HoliDadInn';
import { Ch06_GrabBag } from './scenes/chapters/Ch06_GrabBag';
import { Ch07_FirstBites } from './scenes/chapters/Ch07_FirstBites';
import { Ch08_SleepTraining } from './scenes/chapters/Ch08_SleepTraining';
import { Ch09_MazeWalker } from './scenes/chapters/Ch09_MazeWalker';
import { Ch10_Chatterbox } from './scenes/chapters/Ch10_Chatterbox';
import { Ch11_Ledges } from './scenes/chapters/Ch11_Ledges';
import { Ch12_Liftoff } from './scenes/chapters/Ch12_Liftoff';
import { BonusChapter } from './scenes/BonusChapter';
import { Interlude01_FirstDays } from './scenes/interludes/Interlude01_FirstDays';
import { Interlude02_Mama } from './scenes/interludes/Interlude02_Mama';
import { PostCreditsScene } from './scenes/PostCreditsScene';
import { CinematicScene } from './scenes/CinematicScene';
import { SnotSucker } from './scenes/encounters/SnotSucker';
import { FaceWash } from './scenes/encounters/FaceWash';
import { BottleWait } from './scenes/encounters/BottleWait';
import { ChangingTable } from './scenes/encounters/ChangingTable';
import { Roomba } from './scenes/encounters/Roomba';
import { HUD } from './ui/HUD';
import { installDevModeOverlay } from './ui/DevModeOverlay';
import { SettingsManager } from './systems/Settings';
import { SaveManager } from './systems/SaveManager';
import { DevMode } from './systems/DevMode';
import { SoundBank } from './systems/SoundBank';
import { MusicManager } from './systems/MusicManager';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 480,
  height: 800,
  backgroundColor: '#050409',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    pixelArt: true,
    antialias: false,
    roundPixels: true,
  },
  scene: [
    BootScene,
    SoundNoticeScene,
    MenuScene,
    HouseScene,
    Ch01_Arrival,
    Ch02_FirstSmile,
    Ch03_EyesOpen,
    Ch04_RollOut,
    Ch05_HoliDadInn,
    Ch06_GrabBag,
    Ch07_FirstBites,
    Ch08_SleepTraining,
    Ch09_MazeWalker,
    Ch10_Chatterbox,
    Ch11_Ledges,
    Ch12_Liftoff,
    BonusChapter,
    Interlude01_FirstDays,
    Interlude02_Mama,
    PostCreditsScene, // retired from M12 flow; kept for reference
    CinematicScene,
    SnotSucker,
    FaceWash,
    BottleWait,
    ChangingTable,
    Roomba,
  ],
};

DevMode.load();
// The DEV badge / toggle is only installed in local dev. In production builds it
// never renders, so a party guest can't reach DevMode (which would spoil
// progression and suppress their analytics).
if (import.meta.env.DEV) {
  installDevModeOverlay();
}

const game = new Phaser.Game(config);

// Share Phaser's WebAudio context with SoundBank so synthesis goes through
// the same context Phaser unlocks on first input (critical for iOS Safari).
game.events.once(Phaser.Core.Events.READY, () => {
  const sm = game.sound as Phaser.Sound.WebAudioSoundManager;
  if (sm.context) {
    SoundBank.useContext(sm.context);
  }
  MusicManager.preload();
});

function topActiveScene(): Phaser.Scene | null {
  const scenes = game.scene.getScenes(true);
  if (scenes.length === 0) return null;
  return scenes[scenes.length - 1] ?? null;
}

function activeSceneKey(): string | null {
  return topActiveScene()?.scene.key ?? null;
}

const hudRoot = document.getElementById('hud');
const pauseMenuEl = document.getElementById('pause-menu');
if (!hudRoot || !pauseMenuEl) {
  throw new Error('HUD or pause-menu element missing from index.html');
}

// A paused scene drops out of getScenes(true), so remember which scene we paused
// to drive Resume / Restart / Exit / Home reliably.
let pausedSceneKey: string | null = null;

// Boot/title, sound-notice, and profile screens are NOT gameplay. The gameplay HUD,
// pause, and keyboard movement must exist only while a gameplay scene is on screen.
const MENU_SCENES = new Set(['BootScene', 'SoundNoticeScene', 'MenuScene']);

/** True while any gameplay scene is actually running or paused (i.e. on screen).
 *  NB: isVisible() is NOT used — Phaser scenes default to visible:true even before
 *  they start, so it would report never-started chapters as present. */
function gameplayScenePresent(): boolean {
  for (const s of game.scene.getScenes(false)) {
    const key = s.scene.key;
    if (MENU_SCENES.has(key)) continue;
    if (game.scene.isActive(key) || game.scene.isPaused(key)) {
      return true;
    }
  }
  return false;
}

/** Fully tear down every gameplay scene so nothing survives a return to a menu. */
function stopAllGameplayScenes(): void {
  for (const s of game.scene.getScenes(false)) {
    const key = s.scene.key;
    if (MENU_SCENES.has(key)) continue;
    if (game.scene.isActive(key) || game.scene.isPaused(key) || game.scene.isSleeping(key)) {
      // Resume a paused scene first so it shuts down cleanly, then kill timers/tweens.
      if (game.scene.isPaused(key)) game.scene.resume(key);
      s.time.removeAllEvents();
      s.tweens.killAll();
      game.scene.stop(key);
    }
  }
}

const hud = new HUD(hudRoot, pauseMenuEl, {
  getActiveSceneKey: activeSceneKey,
  onPauseRequested: () => {
    const key = activeSceneKey();
    if (key) {
      pausedSceneKey = key;
      game.scene.pause(key);
    }
  },
  onResumeRequested: () => {
    if (pausedSceneKey) game.scene.resume(pausedSceneKey);
    pausedSceneKey = null;
  },
  onRestartRequested: () => {
    const key = pausedSceneKey;
    pausedSceneKey = null;
    if (!key) return;
    game.scene.resume(key);
    game.scene.start(key);
  },
  onExitRequested: () => {
    const key = pausedSceneKey;
    pausedSceneKey = null;
    if (!key) return;
    // Resume first so the scene exits from a running state (Phaser's stop on a
    // paused scene is safe, but resume lets cleanup hooks run reliably).
    if (game.scene.isPaused(key)) game.scene.resume(key);
    // Kill timers/tweens so nothing leaks into HouseScene, then stop the chapter.
    // Without this stop, both the chapter AND HouseScene run simultaneously with
    // the chapter on top — the root cause of "Exit to House does nothing."
    const exiting = game.scene.getScene(key);
    if (exiting) {
      exiting.time.removeAllEvents();
      exiting.tweens.killAll();
    }
    if (key !== 'HouseScene') game.scene.stop(key);
    // Start HouseScene with the active profile so it resumes at the current room.
    const profile = SaveManager.getActiveProfile();
    game.scene.start('HouseScene', profile ? { profile } : undefined);
  },
  onHomeRequested: () => {
    pausedSceneKey = null;
    // Autosave: profile progress (completed chapters, current room, …) is already
    // persisted on every change; flush the session play-time too. A mid-chapter Home
    // never marks the chapter complete — it simply abandons the chapter, and the
    // overworld state (current room) is what loads next time.
    SaveManager.flushSessionTime();
    // Kill anything that could leak into the menu.
    game.sound.stopAll();
    SoundBank.stopAll();
    // Fully stop EVERY gameplay scene (overworld and any chapter), not just the paused
    // one, so the profile screen replaces gameplay rather than layering over it.
    stopAllGameplayScenes();
    hud.setVisible(false);
    game.scene.start('MenuScene');
  },
  onMuteChange: (muted) => {
    game.sound.mute = muted;
    // Muting must silence anything already in flight (e.g. a lullaby clone), not just
    // block new plays.
    if (muted) SoundBank.stopAll();
    MusicManager.setMuted(muted);
  },
});

// Pre-init mute from default (muted=false). BootScene emits 'settings-loaded'
// after SettingsManager.load() so we resync to the persisted preference (or the
// fresh default) before any audio actually plays.
game.sound.mute = SettingsManager.get().muted;

game.events.once('settings-loaded', () => {
  const muted = SettingsManager.get().muted;
  game.sound.mute = muted;
  MusicManager.setMuted(muted);
  hud.refreshMute();
});

// Drive HUD visibility from scene state: the gameplay HUD exists ONLY while a gameplay
// scene is on screen, and is hidden on boot/title, sound-notice, and profile screens.
let lastHudVisible: boolean | null = null;
game.events.on(Phaser.Core.Events.POST_STEP, () => {
  const visible = gameplayScenePresent();
  if (visible !== lastHudVisible) {
    lastHudVisible = visible;
    hud.setVisible(visible);
  }
});

// Persist play time when tab closes
window.addEventListener('beforeunload', () => {
  SaveManager.flushSessionTime();
});

// Persist play time on visibility change (mobile background)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    SaveManager.flushSessionTime();
  }
});
