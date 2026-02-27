import { cn } from '@/lib/utils';
import {
  Castle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Focus,
  LogIn,
  Plus,
  PowerOff,
  RefreshCw,
  Server,
  Trash2,
  X,
  Zap,
  ZapOff
} from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';

const isElectron = !!(window as any).pulseDesktop?.isElectron;

// ─── Types ───────────────────────────────────────────────────────────────────

interface FoundryServer {
  id: string;
  label: string;
  url: string;
  notes?: string;
}

interface FoundryServerStatus {
  online: boolean;
  version?: string;
  system?: string;
  users?: number;
  partner?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SERVERS_KEY = 'foundry-launcher-servers';

const KNOWN_PARTNERS: { url: string; name: string }[] = [
  { url: 'forge-vtt.com', name: 'The Forge' },
  { url: 'forgevtt.com', name: 'The Forge' },
  { url: 'moltenhosting.com', name: 'Molten Hosting' },
  { url: 'foundryserver.com', name: 'Foundry Server' },
  { url: 'sqyre.app', name: 'Sqyre' }
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadServers(): FoundryServer[] {
  try {
    const raw = localStorage.getItem(SERVERS_KEY);
    return raw ? (JSON.parse(raw) as FoundryServer[]) : [];
  } catch {
    return [];
  }
}

function persistServers(servers: FoundryServer[]) {
  localStorage.setItem(SERVERS_KEY, JSON.stringify(servers));
}

async function fetchServerStatus(
  serverUrl: string
): Promise<FoundryServerStatus> {
  const partner = KNOWN_PARTNERS.find((p) => serverUrl.includes(p.url));
  if (partner) return { online: true, partner: partner.name };

  try {
    // Route through the Pulse server so HTTP Foundry instances don't hit
    // mixed-content CSP blocks in the browser.
    const proxyUrl = `/api/foundry-status?url=${encodeURIComponent(serverUrl)}`;
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return { online: false };
    const data = (await res.json()) as Omit<FoundryServerStatus, 'online'>;
    return { online: true, ...data };
  } catch {
    return { online: false };
  }
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────

const StatusBadge = memo(
  ({ status }: { status: FoundryServerStatus | undefined | null }) => {
    if (status === undefined) {
      // loading
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          <RefreshCw className="h-2.5 w-2.5 animate-spin" />
          Checking
        </span>
      );
    }
    if (status === null || !status.online) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/20 px-2 py-0.5 text-[10px] font-medium text-destructive">
          <ZapOff className="h-2.5 w-2.5" />
          Offline
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-600/20 px-2 py-0.5 text-[10px] font-medium text-green-600">
        <Zap className="h-2.5 w-2.5" />
        {status.partner ?? (status.version ? `v${status.version}` : 'Online')}
      </span>
    );
  }
);

// ─── ServerRow ───────────────────────────────────────────────────────────────

const ServerRow = memo(
  ({
    server,
    isActive,
    status,
    onJoin,
    onDelete,
    onRefresh
  }: {
    server: FoundryServer;
    isActive: boolean;
    status: FoundryServerStatus | undefined | null;
    onJoin: (server: FoundryServer) => void;
    onDelete: (id: string) => void;
    onRefresh: (id: string, url: string) => void;
  }) => (
    <div
      className={cn(
        'group flex items-center gap-2 rounded-md px-2 py-2 transition-colors',
        isActive ? 'bg-primary/10' : 'hover:bg-accent'
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium leading-tight">
            {server.label}
          </span>
          {isActive && (
            <span className="shrink-0 rounded-full bg-green-600/20 px-1.5 py-0.5 text-[9px] font-medium text-green-600">
              Open
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <StatusBadge status={status} />
          {status?.online && status.users !== undefined && (
            <span className="text-[10px] text-muted-foreground">
              {status.users} user{status.users !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {server.notes && (
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {server.notes}
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-1">
        <button
          onClick={() => onJoin(server)}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
            isActive
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-muted-foreground hover:bg-primary hover:text-primary-foreground'
          )}
          title={isActive ? 'Focus window' : 'Open in window'}
        >
          {isActive ? <Focus className="h-3.5 w-3.5" /> : <LogIn className="h-3.5 w-3.5" />}
        </button>
        <button
          onClick={() => onRefresh(server.id, server.url)}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="Refresh status"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
        <button
          onClick={() => onDelete(server.id)}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary text-muted-foreground opacity-0 transition-colors hover:bg-destructive/20 hover:text-destructive group-hover:opacity-100"
          title="Remove"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
);

// ─── ElectronWebview ─────────────────────────────────────────────────────────
// Renders a <webview> with src set on initial mount only.
// The custom memo comparator `() => true` ensures React never re-renders this
// component, so it never calls setAttribute('src', …) again and won't reload.
// Switching servers is handled by `key={activeServerId}` at the call site,
// which forces a full unmount + remount with the new URL.

const ElectronWebview = memo(
  ({ url }: { url: string }) => (
    <webview
      src={url}
      className="h-full w-full border-none"
      allowpopups="true"
    />
  ),
  () => true // never re-render — key changes handle server switching
);



const FoundryView = memo(() => {
  const [servers, setServers] = useState<FoundryServer[]>(() => loadServers());
  const [statuses, setStatuses] = useState<
    Record<string, FoundryServerStatus | null | undefined>
  >({});

  // In Electron: track the active server for the embedded webview.
  // In browser: track the popup window handle.
  const [activeServerId, setActiveServerId] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [panelCollapsed, setPanelCollapsed] = useState(false);

  // Add-server form
  const [addOpen, setAddOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  // Detect when the user closes the popup window
  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = setInterval(() => {
      if (popupRef.current?.closed) {
        popupRef.current = null;
        setActiveServerId(null);
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    }, 500);
  }, []);

  useEffect(() => {
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, []);

  const refreshStatus = useCallback(
    (id: string, serverUrl: string) => {
      setStatuses((prev) => ({ ...prev, [id]: undefined }));
      fetchServerStatus(serverUrl).then((s) => {
        setStatuses((prev) => ({ ...prev, [id]: s }));
      });
    },
    []
  );

  useEffect(() => {
    servers.forEach((s) => refreshStatus(s.id, s.url));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateServers = useCallback((updated: FoundryServer[]) => {
    setServers(updated);
    persistServers(updated);
  }, []);

  const handleAdd = useCallback(() => {
    if (!label.trim()) {
      setFormError('Please enter a server name');
      return;
    }
    try {
      new URL(url);
    } catch {
      setFormError('Please enter a valid URL');
      return;
    }

    const newServer: FoundryServer = {
      id: crypto.randomUUID(),
      label: label.trim(),
      url: url.trim(),
      notes: notes.trim() || undefined
    };

    const updated = [newServer, ...servers];
    updateServers(updated);
    refreshStatus(newServer.id, newServer.url);
    setLabel('');
    setUrl('');
    setNotes('');
    setFormError('');
    setAddOpen(false);
  }, [label, url, notes, servers, updateServers, refreshStatus]);

  const handleDelete = useCallback(
    (id: string) => {
      if (activeServerId === id) {
        popupRef.current?.close();
        popupRef.current = null;
        setActiveServerId(null);
      }
      updateServers(servers.filter((s) => s.id !== id));
      setStatuses((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    [servers, updateServers, activeServerId]
  );

  const handleJoin = useCallback(
    (server: FoundryServer) => {
      if (isElectron) {
        // In Electron: switching the webview src is enough — just update state.
        setActiveServerId(server.id);
        return;
      }

      // Browser fallback: open a popup window (not subject to mixed-content CSP).
      if (activeServerId === server.id && popupRef.current && !popupRef.current.closed) {
        popupRef.current.focus();
        return;
      }
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
      const popup = window.open(
        server.url,
        `foundry-${server.id}`,
        'width=1280,height=800,resizable=yes,scrollbars=yes,status=yes,toolbar=yes,menubar=no,location=yes'
      );
      if (!popup) {
        window.open(server.url, '_blank');
        return;
      }
      popupRef.current = popup;
      setActiveServerId(server.id);
      startHeartbeat();
    },
    [activeServerId, startHeartbeat]
  );

  const handleCancelAdd = useCallback(() => {
    setAddOpen(false);
    setFormError('');
  }, []);

  const handleDisconnect = useCallback(() => {
    if (!isElectron) {
      popupRef.current?.close();
      popupRef.current = null;
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    }
    setActiveServerId(null);
  }, []);

  const activeServer = servers.find((s) => s.id === activeServerId);

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Left panel */}
      <div className={cn(
        'flex shrink-0 flex-col overflow-hidden border-r border-border bg-card transition-all duration-200',
        panelCollapsed ? 'w-12' : 'w-60'
      )}>
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border px-2 py-3">
          {!panelCollapsed && (
            <>
              <Castle className="ml-2 h-4 w-4 shrink-0 text-primary" />
              <h2 className="flex-1 text-[15px] font-semibold tracking-tight">FoundryVTT</h2>
            </>
          )}
          {panelCollapsed && <div className="flex-1" />}
          <button
            onClick={() => setPanelCollapsed((c) => !c)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title={panelCollapsed ? 'Expand panel' : 'Collapse panel'}
          >
            {panelCollapsed
              ? <ChevronRight className="h-4 w-4" />
              : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {panelCollapsed ? (
          /* Collapsed: only show the Disconnect button */
          <div className="flex flex-1 flex-col items-center gap-2 p-2">
            {activeServerId && (
              <button
                onClick={handleDisconnect}
                className="flex h-8 w-8 items-center justify-center rounded-md bg-destructive/10 text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground"
                title="Disconnect Foundry"
              >
                <PowerOff className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : (
          <>

        <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {servers.length === 0 && !addOpen && (
            <div className="py-10 text-center">
              <Server className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">No servers yet.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add a FoundryVTT server URL below.
              </p>
            </div>
          )}
          {servers.map((server) => (
            <ServerRow
              key={server.id}
              server={server}
              isActive={activeServerId === server.id}
              status={statuses[server.id]}
              onJoin={handleJoin}
              onDelete={handleDelete}
              onRefresh={refreshStatus}
            />
          ))}
        </div>

        {addOpen ? (
          <div className="shrink-0 space-y-2 border-t border-border p-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold">Add Server</span>
              <button
                onClick={handleCancelAdd}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <input
              className="w-full rounded-md border border-border bg-input px-2.5 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Server name"
              value={label}
              autoFocus
              onChange={(e) => setLabel(e.target.value)}
            />
            <input
              className="w-full rounded-md border border-border bg-input px-2.5 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="http://yourfoundry.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <input
              className="w-full rounded-md border border-border bg-input px-2.5 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            {formError && (
              <p className="text-xs text-destructive">{formError}</p>
            )}
            <button
              onClick={handleAdd}
              className="w-full rounded-md bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Add Server
            </button>
          </div>
        ) : (
          <div className="shrink-0 border-t border-border p-2">
            <button
              onClick={() => setAddOpen(true)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
              Add Server
            </button>
          </div>
        )}
        </> /* end expanded */
        )}
      </div>

      {/* Main area */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Electron: embedded webview — always mounted when a server is active
            so navigating away and back doesn't reload the game session.
            key=activeServerId ensures it only remounts on an explicit server switch. */}
        {isElectron && activeServer && (
          <ElectronWebview key={activeServerId} url={activeServer.url} />
        )}

        {/* Placeholder shown when no server is selected yet */}
        {(!activeServer || !isElectron) && (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
            {!isElectron && activeServer ? (
              /* Browser fallback: popup is open, show a focus button */
              <>
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
                  <Castle className="h-10 w-10 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">{activeServer.label}</h3>
                  <p className="mt-1 break-all text-sm text-muted-foreground">{activeServer.url}</p>
                </div>
                <div className="flex flex-col items-center gap-3">
                  <button
                    onClick={() => handleJoin(activeServer)}
                    className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <Focus className="h-4 w-4" />
                    Focus Foundry Window
                  </button>
                  <p className="text-xs text-muted-foreground">
                    Foundry is running in a separate window.<br />
                    Switch Pulse servers freely — it won't reload.
                  </p>
                </div>
              </>
            ) : (
              /* No server selected yet */
              <>
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted">
                  <Castle className="h-10 w-10 text-muted-foreground/40" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">FoundryVTT Launcher</h3>
                  <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                    Add a server on the left and press{' '}
                    <LogIn className="inline h-3.5 w-3.5" /> to launch it.
                  </p>
                </div>
                {!isElectron && (
                  <div className="flex max-w-sm items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
                    <ExternalLink className="h-4 w-4 shrink-0 text-primary" />
                    <span>
                      Running in a browser — Foundry will open in a popup window
                      so HTTP servers work alongside HTTPS Pulse.
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export { FoundryView };
