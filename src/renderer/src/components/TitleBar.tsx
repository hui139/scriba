import appLogo from '../assets/logo.png'
import { useT } from '../i18n'
import { CommandIcon, FolderOpenIcon, PanelLeftIcon, PlugIcon, SettingsIcon } from './icons'

interface TitleBarProps {
  platform: string
  sidebarVisible: boolean
  onToggleSidebar: () => void
  onOpenFolder: () => void
  onOpenPlugins: () => void
  onOpenSettings: () => void
  onOpenPalette: () => void
}

/**
 * The title bar holds window chrome and the entry points to the two dialogs.
 *
 * It deliberately shows no document name. The tab strip directly below already names the
 * open document and marks unsaved changes, so repeating it here was pure duplication —
 * and it also meant the sidebar toggle shifted sideways whenever a longer file name was
 * opened, since the name sat in the same row.
 *
 * Theme and language used to have buttons here too; both are preferences and live in
 * Settings.
 */
export function TitleBar({
  platform,
  sidebarVisible,
  onToggleSidebar,
  onOpenFolder,
  onOpenPlugins,
  onOpenSettings,
  onOpenPalette
}: TitleBarProps): JSX.Element {
  const t = useT()
  return (
    <div className={`titlebar${platform === 'darwin' ? ' mac' : platform === 'win32' ? ' win' : ''}`}>
      <div className="app-title">
        <img className="app-logo" src={appLogo} alt="" aria-hidden="true" draggable={false} />
        Scriba
      </div>
      {/* Placed next to the sidebar it controls: a toggle belongs beside the thing it
          toggles, not in the far-right action cluster. */}
      <button
        className={`icon-btn${sidebarVisible ? ' active' : ''}`}
        title={t('titlebar.toggleSidebar')}
        onClick={onToggleSidebar}
      >
        <PanelLeftIcon />
      </button>
      <div className="spacer" />
      <button className="icon-btn" title={t('titlebar.palette')} onClick={onOpenPalette}>
        <CommandIcon />
      </button>
      <button className="icon-btn" title={t('titlebar.openFolder')} onClick={onOpenFolder}>
        <FolderOpenIcon />
      </button>
      <button className="icon-btn" title={t('titlebar.plugins')} onClick={onOpenPlugins}>
        <PlugIcon />
      </button>
      <button className="icon-btn" title={t('titlebar.settings')} onClick={onOpenSettings}>
        <SettingsIcon />
      </button>
    </div>
  )
}
