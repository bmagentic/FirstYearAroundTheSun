import Phaser from 'phaser';
import './styles.css';
import { BootScene } from './scenes/BootScene';
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
    PostCreditsScene,
    SnotSucker,
    FaceWash,
    BottleWait,
    ChangingTable,
    Roomba,
  ],
};

DevMode.load();
installDevModeOverlay();

const game = new Phaser.Game(config);

// Share Phaser's WebAudio context with SoundBank so synthesis goes through
// the same context Phaser unlocks on first input (critical for iOS Safari).
game.events.once(Phaser.Core.Events.READY, () => {
  const sm = game.sound as Phaser.Sound.WebAudioSoundManager;
  if (sm.context) {
    SoundBank.useContext(sm.context);
  }
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

new HUD(hudRoot, pauseMenuEl, {
  getActiveSceneKey: activeSceneKey,
  onPauseRequested: () => {
    const key = activeSceneKey();
    if (key) game.scene.pause(key);
  },
  onResumeRequested: () => {
    const key = activeSceneKey();
    if (key) game.scene.resume(key);
  },
  onRestartRequested: () => {
    const key = activeSceneKey();
    if (!key) return;
    game.scene.resume(key);
    game.scene.start(key);
  },
  onExitRequested: () => {
    const key = activeSceneKey();
    if (!key) return;
    game.scene.resume(key);
    if (key !== 'HouseScene') game.scene.start('HouseScene');
  },
  onMuteChange: (muted) => {
    game.sound.mute = muted;
  },
});

// Apply initial mute state to Phaser sound manager
game.sound.mute = SettingsManager.get().muted;

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
