import { Tray, Menu, nativeImage, app } from 'electron';
import type { BrowserWindow } from 'electron';
import path from 'path';
import type { Store } from './store';

let tray: Tray | null = null;

export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

/** Switch the tray icon to reflect the current voice state. */
export function setTrayIcon(state: 'default' | 'normal' | 'muted'): void {
  if (!tray) return;
  const iconFile =
    state === 'muted'   ? 'microphone-muted.png' :
    state === 'normal'  ? 'microphone-normal.png' :
                          'logo_tray.png';
  const iconPath = path.join(__dirname, '..', '..', 'assets', iconFile);
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  tray.setImage(icon);
}

export function createTray(
  win: BrowserWindow,
  store: Store,
  onChangeServer: () => void,
  onHotkeySettings?: () => void
): Tray {
  const iconPath = path.join(__dirname, '..', '..', 'assets', 'logo_tray.png');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });

  tray = new Tray(icon);
  tray.setToolTip('MeldonCord');

  const updateMenu = () => {
    const minimizeToTray = store.get('minimizeToTray') ?? false;

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show MeldonCord',
        click: () => {
          win.show();
          win.focus();
        },
      },
      {
        label: 'Minimize to Tray',
        type: 'checkbox',
        checked: minimizeToTray,
        click: (menuItem) => {
          store.set('minimizeToTray', menuItem.checked);
        },
      },
      { type: 'separator' },
      {
        label: 'Change Server',
        click: () => {
          win.show();
          win.focus();
          onChangeServer();
        },
      },
      ...(onHotkeySettings ? [{
        label: 'Hotkey Settings',
        click: () => onHotkeySettings(),
      } as Electron.MenuItemConstructorOptions] : []),
      { type: 'separator' as const },
      {
        label: 'Quit',
        click: () => {
          app.quit();
        },
      },
    ]);

    tray!.setContextMenu(contextMenu);
  };

  updateMenu();

  tray.on('click', () => {
    if (win.isVisible()) {
      win.hide();
    } else {
      win.show();
      win.focus();
    }
  });

  return tray;
}
