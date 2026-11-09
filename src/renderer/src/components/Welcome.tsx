import logoUrl from '../assets/logo.png'
import { useT } from '../i18n'

interface WelcomeProps {
  onNew: () => void
  onOpenFile: () => void
  onOpenFolder: () => void
}

/**
 * The app mark.
 *
 * `src/renderer/src/assets/logo.png` is generated from `assets/logo-source.png` by
 * `scripts/build-icons.py`, the same run that produces the window and installer icons,
 * so the welcome screen can never drift from the taskbar icon.
 */
function LogoMark(): JSX.Element {
  return <img className="logo-mark" src={logoUrl} alt="" aria-hidden="true" draggable={false} />
}

export function Welcome({ onNew, onOpenFile, onOpenFolder }: WelcomeProps): JSX.Element {
  const t = useT()
  return (
    <div className="welcome">
      <LogoMark />
      <h1>Scriba</h1>
      <p>{t('welcome.tagline')}</p>
      <div className="actions">
        <button className="btn primary" onClick={onNew}>
          {t('welcome.newFile')}
        </button>
        <button className="btn" onClick={onOpenFile}>
          {t('welcome.openFile')}
        </button>
        <button className="btn" onClick={onOpenFolder}>
          {t('welcome.openFolder')}
        </button>
      </div>
      <p style={{ marginTop: 26, fontSize: 'calc(11.5px * var(--ui-scale))' }}>
        <kbd>Ctrl</kbd> + <kbd>P</kbd> {t('welcome.paletteHint')} · <kbd>Ctrl</kbd> +{' '}
        <kbd>S</kbd> {t('welcome.saveHint')} · <kbd>F8</kbd> {t('welcome.focusHint')}
      </p>
    </div>
  )
}
