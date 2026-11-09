import { app, BrowserWindow, Menu, MenuItemConstructorOptions, shell } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { IPC } from '../shared/ipc'
import { mt } from './i18n'

function send(action: string): void {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  win?.webContents.send(IPC.menuAction, action)
}

function sendWith(action: string, payload: string): void {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  win?.webContents.send(IPC.menuAction, action, payload)
}

async function recentFileItems(): Promise<MenuItemConstructorOptions[]> {
  let list: string[] = []
  try {
    const raw = await fs.readFile(join(app.getPath('userData'), 'recent-files.json'), 'utf8')
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) {
      list = parsed.filter((item): item is string => typeof item === 'string').slice(0, 10)
    }
  } catch {
    list = []
  }

  if (list.length === 0) {
    return [{ label: '(empty)', enabled: false }]
  }

  return [
    ...list.map((filePath) => ({
      label: filePath,
      click: () => sendWith('file:open-recent', filePath)
    })),
    { type: 'separator' as const },
    { label: mt('menu.clearRecent'), click: () => send('file:clear-recent') }
  ]
}

export async function buildMenu(): Promise<void> {
  const isMac = process.platform === 'darwin'
  const recentItems = await recentFileItems()

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const, label: mt('menu.about') },
              { type: 'separator' as const },
              {
                label: mt('menu.settings'),
                accelerator: 'CmdOrCtrl+,',
                click: () => send('settings:open')
              },
              { type: 'separator' as const },
              { role: 'services' as const, label: mt('menu.services') },
              { type: 'separator' as const },
              { role: 'hide' as const, label: mt('menu.hide') },
              { role: 'hideOthers' as const, label: mt('menu.hideOthers') },
              { role: 'unhide' as const, label: mt('menu.unhide') },
              { type: 'separator' as const },
              { role: 'quit' as const, label: mt('menu.quit') }
            ]
          }
        ]
      : []),
    {
      label: mt('menu.file'),
      submenu: [
        { label: mt('menu.newFile'), accelerator: 'CmdOrCtrl+N', click: () => send('file:new') },
        { label: mt('menu.openFile'), accelerator: 'CmdOrCtrl+O', click: () => send('file:open') },
        {
          label: mt('menu.openFolder'),
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => send('folder:open')
        },
        {
          label: mt('menu.openRecent'),
          submenu: recentItems
        },
        { type: 'separator' },
        { label: mt('menu.save'), accelerator: 'CmdOrCtrl+S', click: () => send('file:save') },
        {
          label: mt('menu.saveAs'),
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => send('file:save-as')
        },
        { type: 'separator' },
        { label: mt('menu.exportHtml'), click: () => send('export:html') },
        { label: mt('menu.exportPdf'), click: () => send('export:pdf') },
        { label: mt('menu.exportWord'), click: () => send('export:word') },
        { label: mt('menu.exportText'), click: () => send('export:text') },
        { label: mt('menu.exportImage'), click: () => send('export:image') },
        { label: mt('menu.exportLatex'), click: () => send('export:latex') },
        { label: mt('menu.exportEpub'), click: () => send('export:epub') },
        { type: 'separator' },
        { label: mt('menu.exportFolder'), click: () => send('export:folder') },
        { type: 'separator' },
        { type: 'separator' },
        { label: mt('menu.print'), accelerator: 'CmdOrCtrl+Alt+P', click: () => send('file:print') },
        { type: 'separator' },
        isMac
          ? { role: 'close', label: mt('menu.closeWindow') }
          : { role: 'quit', label: mt('menu.quit') }
      ]
    },
    {
      label: mt('menu.edit'),
      submenu: [
        { role: 'undo', label: mt('menu.undo') },
        { role: 'redo', label: mt('menu.redo') },
        { type: 'separator' },
        { role: 'cut', label: mt('menu.cut') },
        { role: 'copy', label: mt('menu.copy') },
        { role: 'paste', label: mt('menu.paste') },
        { role: 'selectAll', label: mt('menu.selectAll') },
        { type: 'separator' },
        { label: mt('menu.find'), accelerator: 'CmdOrCtrl+F', click: () => send('edit:find') },
        {
          label: mt('menu.replace'),
          accelerator: 'CmdOrCtrl+H',
          registerAccelerator: false,
          click: () => send('edit:replace')
        },
        {
          label: mt('menu.palette'),
          accelerator: 'CmdOrCtrl+P',
          click: () => send('palette:open')
        }
      ]
    },
    {
      label: mt('menu.format'),
      submenu: [
        {
          label: mt('menu.bold'),
          accelerator: 'CmdOrCtrl+B',
          registerAccelerator: false,
          click: () => send('format:bold')
        },
        {
          label: mt('menu.italic'),
          accelerator: 'CmdOrCtrl+I',
          registerAccelerator: false,
          click: () => send('format:italic')
        },
        {
          label: mt('menu.underline'),
          accelerator: 'CmdOrCtrl+U',
          registerAccelerator: false,
          click: () => send('format:underline')
        },
        {
          label: mt('menu.strike'),
          accelerator: 'CmdOrCtrl+Shift+X',
          registerAccelerator: false,
          click: () => send('format:strike')
        },
        {
          label: mt('menu.highlight'),
          accelerator: 'CmdOrCtrl+Shift+H',
          registerAccelerator: false,
          click: () => send('format:highlight')
        },
        { type: 'separator' },
        { label: mt('menu.superscript'), click: () => send('format:sup') },
        { label: mt('menu.subscript'), click: () => send('format:sub') },
        { type: 'separator' },
        { label: mt('menu.inlineCode'), click: () => send('format:code') },
        {
          label: mt('menu.link'),
          accelerator: 'CmdOrCtrl+K',
          registerAccelerator: false,
          click: () => send('insert:link')
        }
      ]
    },
    {
      label: mt('menu.paragraph'),
      submenu: [
        {
          label: mt('menu.heading1'),
          accelerator: 'CmdOrCtrl+1',
          registerAccelerator: false,
          click: () => sendWith('format:heading', '1')
        },
        {
          label: mt('menu.heading2'),
          accelerator: 'CmdOrCtrl+2',
          registerAccelerator: false,
          click: () => sendWith('format:heading', '2')
        },
        {
          label: mt('menu.heading3'),
          accelerator: 'CmdOrCtrl+3',
          registerAccelerator: false,
          click: () => sendWith('format:heading', '3')
        },
        {
          label: mt('menu.heading4'),
          accelerator: 'CmdOrCtrl+4',
          registerAccelerator: false,
          click: () => sendWith('format:heading', '4')
        },
        {
          label: mt('menu.heading5'),
          accelerator: 'CmdOrCtrl+5',
          registerAccelerator: false,
          click: () => sendWith('format:heading', '5')
        },
        {
          label: mt('menu.heading6'),
          accelerator: 'CmdOrCtrl+6',
          registerAccelerator: false,
          click: () => sendWith('format:heading', '6')
        },
        {
          label: mt('menu.paragraphPlain'),
          accelerator: 'CmdOrCtrl+0',
          registerAccelerator: false,
          click: () => sendWith('format:heading', '0')
        },
        { type: 'separator' },
        {
          label: mt('menu.promoteHeading'),
          accelerator: 'CmdOrCtrl+=',
          registerAccelerator: false,
          click: () => send('format:promote')
        },
        {
          label: mt('menu.demoteHeading'),
          accelerator: 'CmdOrCtrl+-',
          registerAccelerator: false,
          click: () => send('format:demote')
        },
        { type: 'separator' },
        {
          label: mt('menu.table'),
          accelerator: 'CmdOrCtrl+T',
          registerAccelerator: false,
          click: () => send('insert:table')
        },
        {
          label: mt('menu.codeFence'),
          accelerator: 'CmdOrCtrl+Shift+K',
          registerAccelerator: false,
          click: () => send('insert:code-block')
        },
        {
          label: mt('menu.mathBlock'),
          accelerator: 'CmdOrCtrl+Shift+M',
          registerAccelerator: false,
          click: () => send('insert:math')
        },
        { type: 'separator' },
        {
          label: mt('menu.quote'),
          accelerator: 'CmdOrCtrl+Shift+Q',
          registerAccelerator: false,
          click: () => send('format:quote')
        },
        {
          label: mt('menu.orderedList'),
          accelerator: 'CmdOrCtrl+Shift+[',
          registerAccelerator: false,
          click: () => send('format:ordered-list')
        },
        {
          label: mt('menu.unorderedList'),
          accelerator: 'CmdOrCtrl+Shift+]',
          registerAccelerator: false,
          click: () => send('format:bullet-list')
        },
        {
          label: mt('menu.taskList'),
          accelerator: 'CmdOrCtrl+Shift+T',
          registerAccelerator: false,
          click: () => send('format:task-list')
        },
        { type: 'separator' },
        {
          label: mt('menu.indent'),
          accelerator: 'CmdOrCtrl+]',
          registerAccelerator: false,
          click: () => send('format:indent')
        },
        {
          label: mt('menu.outdent'),
          accelerator: 'CmdOrCtrl+[',
          registerAccelerator: false,
          click: () => send('format:outdent')
        }
      ]
    },
    {
      label: mt('menu.insert'),
      submenu: [
        {
          label: mt('menu.insertImage'),
          accelerator: 'CmdOrCtrl+Shift+G',
          registerAccelerator: false,
          click: () => send('insert:image')
        },
        { label: mt('menu.insertTable'), click: () => send('insert:table') },
        { label: mt('menu.insertFootnote'), click: () => send('insert:footnote') },
        { label: mt('menu.insertToc'), click: () => send('insert:toc') },
        { type: 'separator' },
        { label: mt('menu.insertHr'), click: () => send('insert:hr') },
        { label: mt('menu.insertCodeBlock'), click: () => send('insert:code-block') },
        { label: mt('menu.mathBlock'), click: () => send('insert:math') },
        { type: 'separator' },
        {
          label: mt('menu.insertParagraphBefore'),
          accelerator: 'CmdOrCtrl+Shift+Enter',
          registerAccelerator: false,
          click: () => send('insert:paragraph-before')
        },
        {
          label: mt('menu.insertParagraphAfter'),
          accelerator: 'CmdOrCtrl+Enter',
          registerAccelerator: false,
          click: () => send('insert:paragraph-after')
        }
      ]
    },
    {
      label: mt('menu.view'),
      submenu: [
        {
          label: mt('menu.toggleSidebar'),
          accelerator: 'CmdOrCtrl+\\',
          click: () => send('view:sidebar')
        },
        {
          label: mt('menu.toggleOutline'),
          accelerator: 'CmdOrCtrl+Shift+1',
          click: () => send('view:outline')
        },
        { type: 'separator' },
        { label: mt('menu.focus'), accelerator: 'F8', click: () => send('view:focus') },
        { label: mt('menu.typewriter'), accelerator: 'F9', click: () => send('view:typewriter') },
        {
          label: mt('menu.sourceMode'),
          accelerator: 'CmdOrCtrl+/',
          registerAccelerator: false,
          click: () => send('view:source')
        },
        { type: 'separator' },
        { label: mt('menu.switchLanguage'), accelerator: 'CmdOrCtrl+Shift+L', click: () => send('language:cycle') },
        { type: 'separator' },
        ...(isMac
          ? []
          : [
              {
                label: mt('menu.settings'),
                accelerator: 'CmdOrCtrl+,',
                click: () => send('settings:open')
              },
              { type: 'separator' as const }
            ]),
        { role: 'resetZoom', label: mt('menu.resetZoom') },
        { role: 'zoomIn', label: mt('menu.zoomIn') },
        { role: 'zoomOut', label: mt('menu.zoomOut') },
        { type: 'separator' },
        { role: 'togglefullscreen', label: mt('menu.fullscreen') },
        { role: 'toggleDevTools', label: mt('menu.devtools') }
      ]
    },
    {
      label: mt('menu.plugins'),
      submenu: [
        { label: mt('menu.pluginManager'), click: () => send('plugins:manage') },
        { label: mt('menu.reloadPlugins'), click: () => send('plugins:reload') },
        { type: 'separator' },
        { label: mt('menu.openPluginsFolder'), click: () => send('plugins:open-dir') },
        { label: mt('menu.openThemesFolder'), click: () => send('themes:open-dir') }
      ]
    },
    {
      label: mt('menu.help'),
      submenu: [
        {
          label: mt('menu.website'),
          click: () => shell.openExternal('https://github.com/hui139/scriba')
        },
        {
          label: mt('menu.reportIssue'),
          click: () => shell.openExternal('https://github.com/hui139/scriba/issues')
        },
        { type: 'separator' },
        {
          label: mt('menu.devtools'),
          accelerator: 'CmdOrCtrl+Shift+I',
          role: 'toggleDevTools'
        }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
