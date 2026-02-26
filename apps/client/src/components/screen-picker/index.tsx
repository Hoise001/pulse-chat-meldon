import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCallback, useEffect, useRef, useState } from 'react';

// A source as we store it internally — thumbnail resolved to a data URL string
type TSource = {
  id: string;
  name: string;
  thumbnailUrl: string | null;
};

function extractThumbnailUrl(src: DesktopCapturerSourceSerialized): string | null {
  try {
    // NativeImage with toDataURL (normal IPC path)
    if (typeof src.thumbnail?.toDataURL === 'function') {
      const url = src.thumbnail.toDataURL();
      // Empty PNG: just the header with no pixel data
      if (!url || url === 'data:image/png;base64,' || url.length < 50) return null;
      return url;
    }
    // Already a plain string (pre-serialised)
    if (typeof (src.thumbnail as unknown as string) === 'string') {
      const s = src.thumbnail as unknown as string;
      return s.startsWith('data:') ? s : null;
    }
  } catch {
    // fall through
  }
  return null;
}

function sourcesToState(raw: DesktopCapturerSourceSerialized[]): TSource[] {
  return raw.map((s) => ({
    id: s.id,
    name: s.name,
    thumbnailUrl: extractThumbnailUrl(s),
  }));
}

const ScreenPicker = () => {
  const [sources, setSources] = useState<TSource[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [audio, setAudio] = useState(false);
  const [open, setOpen] = useState(false);
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Prevents double-responding (e.g. cancel button click + onOpenChange both firing)
  const respondedRef = useRef(false);

  // Fetch fresh thumbnails from the main process and merge into state
  const refreshThumbnails = useCallback(async () => {
    const picker = window.pulseDesktop?.screenPicker;
    if (!picker) return;
    try {
      const fresh = await picker.getSources();
      setSources((prev) => {
        // Keep current list order/names, just update thumbnails
        const map = new Map(fresh.map((s) => [s.id, s]));
        return prev.map((s) => {
          const f = map.get(s.id);
          return f ? { ...s, thumbnailUrl: extractThumbnailUrl(f) ?? s.thumbnailUrl } : s;
        });
      });
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    const picker = window.pulseDesktop?.screenPicker;
    if (!picker) return;

    picker.onShow((incoming) => {
      const initial = sourcesToState(incoming);
      setSources(initial);
      setSelectedId(initial[0]?.id ?? null);
      setAudio(false);
      respondedRef.current = false;
      setOpen(true);
    });
  }, []);

  // While the picker is open: fetch thumbnails immediately then refresh every 2 s
  useEffect(() => {
    if (!open) {
      if (refreshRef.current) clearInterval(refreshRef.current);
      return;
    }
    refreshThumbnails();
    refreshRef.current = setInterval(refreshThumbnails, 2000);
    return () => {
      if (refreshRef.current) clearInterval(refreshRef.current);
    };
  }, [open, refreshThumbnails]);

  const handleConfirm = useCallback(() => {
    if (!selectedId || respondedRef.current) return;
    respondedRef.current = true;
    setOpen(false);
    window.pulseDesktop!.screenPicker!.select(selectedId, audio);
  }, [selectedId, audio]);

  const handleCancel = useCallback(() => {
    if (respondedRef.current) return;
    respondedRef.current = true;
    setOpen(false);
    window.pulseDesktop!.screenPicker!.cancel();
  }, []);

  // Screens first, then windows
  const screens = sources.filter((s) => s.id.startsWith('screen:'));
  const windows = sources.filter((s) => !s.id.startsWith('screen:'));

  return (
    <Dialog open={open}>
      <DialogContent
        className="max-w-3xl select-none"
        // Handle Escape key and clicking the backdrop directly on the content element.
        // This avoids using onOpenChange which also fires at the end of the exit
        // animation — after respondedRef has already been reset for the next session —
        // which would incorrectly cancel the new in-flight getDisplayMedia request.
        onEscapeKeyDown={(e) => { e.preventDefault(); handleCancel(); }}
        onInteractOutside={(e) => { e.preventDefault(); handleCancel(); }}
      >
        <DialogHeader>
          <DialogTitle>Share your screen</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 overflow-y-auto max-h-[60vh] pr-1">
          {screens.length > 0 && (
            <Section
              label="Entire Screen"
              sources={screens}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          )}
          {windows.length > 0 && (
            <Section
              label="Application Window"
              sources={windows}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          )}
        </div>

        {/* Audio toggle — only relevant on Windows with loopback */}
        {window.pulseDesktop?.platform === 'win32' && (
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none mt-1">
            <input
              type="checkbox"
              className="w-4 h-4 accent-[#5865f2] cursor-pointer"
              checked={audio}
              onChange={(e) => setAudio(e.target.checked)}
            />
            Share system audio
          </label>
        )}

        <DialogFooter className="gap-2">
          <button
            className="px-4 py-2 rounded text-sm font-medium bg-transparent border border-white/20 hover:bg-white/10 transition-colors"
            onClick={handleCancel}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 rounded text-sm font-medium bg-[#5865f2] hover:bg-[#4752c4] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            disabled={!selectedId}
            onClick={handleConfirm}
          >
            Share
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

type TSectionProps = {
  label: string;
  sources: TSource[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

const Section = ({ label, sources, selectedId, onSelect }: TSectionProps) => (
  <div>
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
      {label}
    </p>
    <div className="grid grid-cols-3 gap-3">
      {sources.map((src) => (
        <SourceTile
          key={src.id}
          source={src}
          selected={src.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  </div>
);

type TSourceTileProps = {
  source: TSource;
  selected: boolean;
  onSelect: (id: string) => void;
};

const SourceTile = ({ source, selected, onSelect }: TSourceTileProps) => (
  <button
    type="button"
    onClick={() => onSelect(source.id)}
    className={[
      'flex flex-col items-center gap-2 p-2 rounded-md border-2 transition-colors text-left',
      selected
        ? 'border-[#5865f2] bg-[#5865f2]/10'
        : 'border-transparent bg-white/5 hover:bg-white/10',
    ].join(' ')}
  >
    <div className="w-full aspect-video rounded overflow-hidden bg-black flex items-center justify-center">
      {source.thumbnailUrl ? (
        <img
          src={source.thumbnailUrl}
          alt={source.name}
          className="w-full h-full object-contain"
        />
      ) : (
        <span className="text-muted-foreground text-xs">Loading…</span>
      )}
    </div>
    <span className="text-xs text-center w-full truncate leading-tight">
      {source.name}
    </span>
  </button>
);

export { ScreenPicker };
