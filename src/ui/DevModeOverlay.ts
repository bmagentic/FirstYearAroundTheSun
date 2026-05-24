import { DevMode } from '../systems/DevMode';

export function installDevModeOverlay(): void {
  const btn = document.createElement('button');
  btn.id = 'devmode-toggle';
  btn.type = 'button';
  btn.textContent = 'DEV';

  const applyStyle = (enabled: boolean): void => {
    Object.assign(btn.style, {
      position: 'fixed',
      top: '10px',
      left: '10px',
      zIndex: '50',
      padding: '4px 10px',
      background: enabled ? 'rgba(220, 38, 38, 0.95)' : 'rgba(40, 30, 20, 0.7)',
      color: enabled ? '#ffffff' : 'rgba(253, 230, 138, 0.55)',
      fontSize: '11px',
      fontWeight: '700',
      letterSpacing: '0.08em',
      border: enabled ? '1px solid rgba(255,255,255,0.4)' : '1px dashed rgba(253, 230, 138, 0.35)',
      borderRadius: '6px',
      cursor: 'pointer',
      fontFamily: 'system-ui, sans-serif',
      touchAction: 'manipulation',
    } satisfies Partial<CSSStyleDeclaration>);
  };

  applyStyle(DevMode.isEnabled());

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const next = DevMode.toggle();
    applyStyle(next);
    btn.animate(
      [
        { transform: 'scale(0.85)' },
        { transform: 'scale(1.15)' },
        { transform: 'scale(1)' },
      ],
      { duration: 220, easing: 'ease-out' },
    );
    console.log('[devmode]', next ? 'ON' : 'OFF');
  });

  document.body.appendChild(btn);

  DevMode.onChange((enabled) => applyStyle(enabled));
}
