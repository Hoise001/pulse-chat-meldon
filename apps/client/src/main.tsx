import { Toaster } from '@/components/ui/sonner';
import 'prosemirror-view/style/prosemirror.css';
import '@/i18n'; // must be imported before any component that calls useTranslation
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { ScreenPicker } from './components/screen-picker';
import { StoreDebug } from './components/debug/store-debug.tsx';
import { DevicesProvider } from './components/devices-provider/index.tsx';
import { DialogsProvider } from './components/dialogs/index.tsx';
import { E2EESetupModal } from './components/e2ee-setup-modal.tsx';
import { Routing } from './components/routing/index.tsx';
import { ServerScreensProvider } from './components/server-screens/index.tsx';
import { ThemeProvider } from './components/theme-provider/index.tsx';
import { store } from './features/store.ts';
import { LocalStorageKey } from './helpers/storage.ts';
import { StreamViewerScreen } from './screens/stream-viewer-screen.tsx';
import './index.css';

/** Displayed only in the dedicated Electron stream-viewer BrowserWindow. */
const StreamViewerBootstrap = () => {
  const svChannelId = new URLSearchParams(window.location.search).get('__svCh');
  if (!svChannelId || !window.pulseDesktop?.streamViewer) return null;
  return <StreamViewerScreen channelId={parseInt(svChannelId, 10)} />;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider
      defaultTheme="dark"
      storageKey={LocalStorageKey.VITE_UI_THEME}
    >
      <Toaster />
      <Provider store={store}>
        <StoreDebug />
        <DevicesProvider>
          <DialogsProvider />
          <E2EESetupModal />
          <ServerScreensProvider />
          <ScreenPicker />
          <Routing />
          {/* Stream viewer overlay — only active in the dedicated viewer window */}
          <StreamViewerBootstrap />
        </DevicesProvider>
      </Provider>
    </ThemeProvider>
  </StrictMode>
);
