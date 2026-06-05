import Phaser from 'phaser';

/**
 * Freeze gameplay behind a modal (intro card, instruction panel, retry popup) while
 * letting the modal's own tweens keep animating.
 *
 * Phaser 3.60+ `tweens.pauseAll()` halts the WHOLE manager — its `update()` only
 * steps `if (!this.paused)`, so tweens added AFTER pauseAll never run either (a modal
 * faded in this way stays at alpha 0, invisible, and any tween-driven timer never
 * fires). Instead we pause the individual tweens that exist right now and the scene
 * clock; the manager keeps stepping, so tweens created after the freeze animate.
 *
 * @returns a `thaw()` that resumes exactly the tweens we paused and unpauses the clock.
 */
export function freezeScene(scene: Phaser.Scene): () => void {
  const frozen = scene.tweens.getTweens();
  for (const t of frozen) t.pause();
  scene.time.paused = true;

  let thawed = false;
  return () => {
    if (thawed) return;
    thawed = true;
    scene.time.paused = false;
    for (const t of frozen) {
      if (!t.isDestroyed()) t.resume();
    }
  };
}
