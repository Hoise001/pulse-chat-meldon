import { app, BrowserWindow, ipcMain, shell, net, Menu, globalShortcut, webContents } from 'electron';
import path from 'path';
import fs from 'fs';
import { Store } from './lib/store';
import { loadWindowState, trackWindowState } from './lib/window-state';
import { setupPermissions, requestMediaAccess, consumePendingProcessAudioSourceId } from './lib/permissions';
import { createTray, destroyTray, setTrayIcon } from './lib/tray';
import { APP_NAME, PRELOAD_PATH, SERVER_SELECTOR_PATH } from './lib/constants';
import { getDriverStatus, installDriver, uninstallDriver } from './lib/audio-driver';
import { canCaptureSystemAudio, startSystemAudioCapture, stopSystemAudioCapture } from './lib/audio-capture';
import { canCaptureProcessAudio, startProcessAudioCapture, stopProcessAudioCapture } from './lib/win-process-audio';

const store = new Store();
let mainWindow: BrowserWindow | null = null;
let isQuitting = false;
let hotkeyWin: BrowserWindow | null = null;
let streamViewerWin: BrowserWindow | null = null;
let streamViewerSourceWCId: number | null = null;
let muteBinding: string[] | null = null;
let uIOhook: any = null;
const heldKeys = new Set<string>();

// ── Settings persistence ─────────────────────────────────────────────────────
const settingsPath = path.join(app.getPath('userData'), 'pulse-settings.json');

function loadSettingsFile(): Record<string, any> {
  try {
    if (fs.existsSync(settingsPath)) return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch {}
  return {};
}

function saveSettingsFile(data: Record<string, any>) {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify({ ...loadSettingsFile(), ...data }, null, 2));
  } catch (e) {
    console.error('[Pulse] Failed to save settings:', e);
  }
}

function loadBindings() {
  const s = loadSettingsFile();
  muteBinding = s.bindings?.mute ?? null;
}

// ── Hotkey / uIOhook ─────────────────────────────────────────────────────────
function buildKeycodeMap(UiohookKey: Record<string, any>): Record<number, string> {
  const RENAMES: Record<string, string> = {
    'Ctrl': 'Control', 'CtrlRight': 'Control', 'ShiftRight': 'Shift',
    'Alt': 'Alt', 'AltRight': 'Alt', 'Meta': 'Super', 'MetaRight': 'Super',
    'Enter': 'Return', 'ArrowLeft': 'Left', 'ArrowRight': 'Right',
    'ArrowUp': 'Up', 'ArrowDown': 'Down',
  };

  // uiohook-napi names letter keys "KeyA"…"KeyZ" and digit keys "Digit0"…"Digit9".
  // hotkeys.html normalizeKey() saves them as bare letters/digits ("A", "1").
  // Strip the prefix so both sides agree.
  function normalizeName(name: string): string {
    if (RENAMES[name]) return RENAMES[name];
    if (/^Key[A-Z]$/.test(name)) return name.slice(3);       // "KeyM" → "M"
    if (/^Digit\d$/.test(name)) return name.slice(5);        // "Digit1" → "1"
    if (/^Numpad\d$/.test(name)) return name.slice(6);       // "Numpad1" → "1" (same as Digit)
    return name;
  }

  const map: Record<number, string> = {};
  for (const [name, code] of Object.entries(UiohookKey)) {
    if (!isNaN(Number(name))) continue;
    map[code as number] = normalizeName(name);
  }
  return map;
}

function comboMatchesHeld(combo: string[]): boolean {
  if (!combo || combo.length === 0) return false;
  return combo.every(k => heldKeys.has(k)) && heldKeys.size === combo.length;
}

function clickMuteButton() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  // Dispatch Ctrl+Shift+M via executeJavaScript — this works even when the
  // window lacks OS focus, unlike sendInputEvent. The client's
  // use-keyboard-shortcuts.ts handles this combo and calls toggleMic().
  mainWindow.webContents.executeJavaScript(`
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'm', code: 'KeyM', ctrlKey: true, shiftKey: true,
      bubbles: true, cancelable: true
    }));
  `).catch(() => {});

  setTimeout(() => {
    checkVoiceState().then(state => {
      if (state === 'not-in-voice') setTrayIcon('default');
      else if (state === 'muted') setTrayIcon('muted');
      else setTrayIcon('normal');
    });
  }, 50);
}

function startUIOhook() {
  try {
    const uiohookNapi = require('uiohook-napi');
    uIOhook = uiohookNapi;
    const KEYCODE_TO_NAME = buildKeycodeMap(uiohookNapi.UiohookKey);
    const F8_CODE = uiohookNapi.UiohookKey.F8;

    uIOhook.uIOhook.on('keydown', (e: any) => {
      const name = KEYCODE_TO_NAME[e.keycode];
      if (!name || e.keycode === F8_CODE) return;
      heldKeys.add(name);
      console.log('[hotkey] held:', [...heldKeys], '| binding:', muteBinding);
      if (muteBinding && comboMatchesHeld(muteBinding)) {
        clickMuteButton();
      }
    });

    uIOhook.uIOhook.on('keyup', (e: any) => {
      const name = KEYCODE_TO_NAME[e.keycode];
      if (name) heldKeys.delete(name);
    });

    uIOhook.uIOhook.start();
    console.log('[Pulse] uIOhook started');
  } catch (e: any) {
    console.warn('[Pulse] uiohook-napi not available:', e.message);
  }
}

// ── Voice state polling ───────────────────────────────────────────────────────
function checkVoiceState(): Promise<string> {
  if (!mainWindow || mainWindow.isDestroyed()) return Promise.resolve('not-in-voice');
  return mainWindow.webContents.executeJavaScript(`
    (function() {
      const voiceIndicator = Array.from(document.querySelectorAll('span'))
        .find(el => el.textContent.trim() === 'Voice connected');
      if (!voiceIndicator) return 'not-in-voice';
      const isMuted = !!Array.from(document.querySelectorAll('button[title]')).find(b =>
        b.title.toLowerCase().includes('unmute microphone')
      );
      return isMuted ? 'muted' : 'unmuted';
    })();
  `).catch(() => 'not-in-voice');
}

function startVoicePolling() {
  setInterval(async () => {
    const state = await checkVoiceState();
    if (state === 'not-in-voice') setTrayIcon('default');
    else if (state === 'muted') setTrayIcon('muted');
    else setTrayIcon('normal');
  }, 500);
}

// ── Hotkey settings window ────────────────────────────────────────────────────
function openHotkeySettings() {
  if (hotkeyWin && !hotkeyWin.isDestroyed()) { hotkeyWin.focus(); return; }
  hotkeyWin = new BrowserWindow({
    width: 420,
    height: 380,
    title: 'Hotkey Settings',
    resizable: false,
    parent: mainWindow ?? undefined,
    modal: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'hotkeys-preload.js'),
    }
  });
  hotkeyWin.setMenuBarVisibility(false);
  hotkeyWin.loadFile(path.join(__dirname, '..', 'assets', 'hotkeys.html'));
  hotkeyWin.on('closed', () => { hotkeyWin = null; });
}

function disconnectServer(): void {
  store.delete('serverUrl');
  store.delete('serverName');
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.loadFile(SERVER_SELECTOR_PATH);
  }
}

function createWindow(): BrowserWindow {
  const windowState = loadWindowState(store);

  const win = new BrowserWindow({
    title: APP_NAME,
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    minWidth: 940,
    minHeight: 600,
    backgroundColor: '#313338',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      autoplayPolicy: 'no-user-gesture-required',
      webviewTag: true,
    },
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
  });

  if (windowState.isMaximized) {
    win.maximize();
  }

  // Show window when ready
  win.once('ready-to-show', () => {
    win.show();
  });

  // Track window state changes
  trackWindowState(win, store);

  // Setup media permissions
  setupPermissions(win.webContents.session, win);

  // Handle external links — open in default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    // Block dangerous URL schemes
    const lower = url.toLowerCase().trim();
    if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) {
      console.warn('[security] Blocked dangerous URL:', url);
      return { action: 'deny' };
    }

    try {
      const linkUrl = new URL(url);
      const serverUrl = store.get('serverUrl');

      // Allow same-origin navigation (e.g. OAuth popups)
      if (serverUrl) {
        const server = new URL(serverUrl);
        if (linkUrl.origin === server.origin) {
          return { action: 'allow' };
        }
      }

      // Only allow http/https external links
      if (linkUrl.protocol === 'http:' || linkUrl.protocol === 'https:') {
        shell.openExternal(url);
      }
    } catch {
      console.warn('[security] Blocked invalid URL:', url);
    }

    return { action: 'deny' };
  });

  // Minimize to tray on close instead of quitting (opt-in)
  win.on('close', (event) => {
    if (isQuitting) return;

    const minimizeToTray = store.get('minimizeToTray');
    if (minimizeToTray) {
      event.preventDefault();
      win.hide();
    }
  });

  // Load server or selector
  const serverUrl = store.get('serverUrl');
  if (serverUrl) {
    win.loadURL(serverUrl);
  } else {
    win.loadFile(SERVER_SELECTOR_PATH);
  }

  return win;
}

// IPC Handlers
function setupIpcHandlers(): void {
  ipcMain.handle('connect-to-server', async (_event, url: string) => {
    // Normalize URL
    let serverUrl = url.trim();
    if (!serverUrl.startsWith('http://') && !serverUrl.startsWith('https://')) {
      serverUrl = `https://${serverUrl}`;
    }
    // Remove trailing slash
    serverUrl = serverUrl.replace(/\/+$/, '');

    // Validate by fetching /info
    try {
      const response = await net.fetch(`${serverUrl}/info`);
      if (!response.ok) {
        return { success: false, error: `Server returned ${response.status}` };
      }

      const data = (await response.json()) as { name?: string; version?: string };

      store.set('serverUrl', serverUrl);
      store.set('serverName', data.name ?? 'Pulse Server');

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(serverUrl);
      }

      return { success: true, name: data.name, version: data.version };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('disconnect-server', () => {
    disconnectServer();
  });

  ipcMain.handle('get-settings', () => {
    return store.getAll();
  });

  ipcMain.handle('update-setting', (_event, key: string, value: unknown) => {
    if (key === 'minimizeToTray' && typeof value === 'boolean') {
      store.set('minimizeToTray', value);
    }
  });

  // Audio driver management (macOS)
  ipcMain.handle('audio-driver:status', () => getDriverStatus());
  ipcMain.handle('audio-driver:install', () => installDriver());
  ipcMain.handle('audio-driver:uninstall', () => uninstallDriver());

  // Audio capture lifecycle (macOS)
  ipcMain.handle('audio-capture:available', () => canCaptureSystemAudio());
  ipcMain.handle('audio-capture:start', () => startSystemAudioCapture());
  ipcMain.handle('audio-capture:stop', () => {
    stopSystemAudioCapture();
  });

  // Windows process-loopback audio capture (Win10 build 20348 / Win11+)
  ipcMain.handle('win-process-audio:can-capture', () => canCaptureProcessAudio());
  ipcMain.handle('win-process-audio:get-pending-source', () => consumePendingProcessAudioSourceId());
  ipcMain.handle('win-process-audio:start', async (event, sourceId: string) => {
    if (!mainWindow || mainWindow.isDestroyed()) return null;
    const result = await startProcessAudioCapture(sourceId, event.sender);
    return result; // { sampleRate, channels } or null
  });
  ipcMain.handle('win-process-audio:stop', () => {
    stopProcessAudioCapture();
  });

  // Hotkey settings
  ipcMain.handle('hotkeys-get', () => ({ mute: muteBinding }));
  ipcMain.on('hotkeys-save', (_event, newBindings) => {
    muteBinding = newBindings.mute ?? null;
    saveSettingsFile({ bindings: { mute: muteBinding } });
    if (hotkeyWin && !hotkeyWin.isDestroyed()) hotkeyWin.close();
  });
  ipcMain.on('hotkeys-cancel', () => {
    if (hotkeyWin && !hotkeyWin.isDestroyed()) hotkeyWin.close();
  });

  // ── Stream viewer window ──────────────────────────────────────────────────
  ipcMain.handle('stream-viewer:open', async (event, channelId: number) => {
    streamViewerSourceWCId = event.sender.id;

    if (streamViewerWin && !streamViewerWin.isDestroyed()) {
      streamViewerWin.focus();
      return streamViewerWin.webContents.id;
    }

    const serverUrl = store.get('serverUrl');
    if (!serverUrl) return null;

    streamViewerWin = new BrowserWindow({
      fullscreen: true,
      backgroundColor: '#000000',
      title: 'Stream Viewer',
      autoHideMenuBar: true,
      webPreferences: {
        preload: PRELOAD_PATH,
        contextIsolation: true,
        nodeIntegration: false,
        autoplayPolicy: 'no-user-gesture-required',
      },
    });

    streamViewerWin.on('closed', () => {
      // Notify the source renderer so it can tear down its RTCPeerConnection
      if (streamViewerSourceWCId) {
        const src = webContents.fromId(streamViewerSourceWCId);
        src?.send('stream-viewer:closed');
      }
      streamViewerWin = null;
      streamViewerSourceWCId = null;
    });

    const viewerUrl = `${serverUrl}?__svCh=${channelId}`;
    streamViewerWin.loadURL(viewerUrl);

    return new Promise<number>((resolve) => {
      streamViewerWin!.webContents.once('dom-ready', () => {
        resolve(streamViewerWin!.webContents.id);
      });
    });
  });

  ipcMain.handle('stream-viewer:close', () => {
    streamViewerWin?.close();
  });

  // Relay WebRTC signaling: source renderer → viewer
  ipcMain.on('stream-viewer:signal-to-viewer', (_event, data: unknown) => {
    if (streamViewerWin && !streamViewerWin.isDestroyed()) {
      streamViewerWin.webContents.send('stream-viewer:signal', data);
    }
  });

  // Relay WebRTC signaling: viewer renderer → source
  ipcMain.on('stream-viewer:signal-to-source', (_event, data: unknown) => {
    if (streamViewerSourceWCId) {
      const src = webContents.fromId(streamViewerSourceWCId);
      src?.send('stream-viewer:signal', data);
    }
  });

  // Viewer ready: forward to source so it can send the WebRTC offer
  ipcMain.on('stream-viewer:viewer-ready', () => {
    if (streamViewerSourceWCId) {
      const src = webContents.fromId(streamViewerSourceWCId);
      src?.send('stream-viewer:viewer-ready');
    }
  });
}

// App lifecycle
app.on('before-quit', () => {
  isQuitting = true;
  destroyTray();
  stopSystemAudioCapture();
  stopProcessAudioCapture();
  globalShortcut.unregisterAll();
  if (uIOhook) try { uIOhook.uIOhook.stop(); } catch {}
});

app.whenReady().then(async () => {
  // Request macOS system-level mic/camera access BEFORE creating the window
  await requestMediaAccess();

  // Application menu (ensures Cmd+Q works on macOS)
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: APP_NAME,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

  setupIpcHandlers();
  loadBindings();
  startUIOhook();
  globalShortcut.register('F8', openHotkeySettings);
  mainWindow = createWindow();
  createTray(mainWindow, store, disconnectServer, openHotkeySettings);
  startVoicePolling();

  app.on('activate', () => {
    // macOS: re-create window when dock icon clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    } else if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
    }
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
