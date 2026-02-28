import { IconButton } from '@/components/ui/icon-button';
import { useUserById } from '@/features/server/users/hooks';
import { cn } from '@/lib/utils';
import { Maximize2, Monitor, ZoomIn, ZoomOut } from 'lucide-react';
import { memo, useCallback, useState } from 'react';
import { FullscreenStreamOverlay } from './fullscreen-stream-overlay';
import { CardControls } from './card-controls';
import { CardGradient } from './card-gradient';
import { useScreenShareZoom } from './hooks/use-screen-share-zoom';
import { useVoiceRefs } from './hooks/use-voice-refs';
import { PinButton } from './pin-button';

type tScreenShareControlsProps = {
  isPinned: boolean;
  isZoomEnabled: boolean;
  handlePinToggle: () => void;
  handleToggleZoom: () => void;
  handleFullscreen: () => void;
  showPinControls: boolean;
};

const ScreenShareControls = memo(
  ({
    isPinned,
    isZoomEnabled,
    handlePinToggle,
    handleToggleZoom,
    handleFullscreen,
    showPinControls
  }: tScreenShareControlsProps) => {
    return (
      <CardControls>
        {showPinControls && isPinned && (
          <IconButton
            variant={isZoomEnabled ? 'default' : 'ghost'}
            icon={isZoomEnabled ? ZoomOut : ZoomIn}
            onClick={handleToggleZoom}
            title={isZoomEnabled ? 'Disable Zoom' : 'Enable Zoom'}
            size="sm"
          />
        )}
        <IconButton
          variant="ghost"
          icon={Maximize2}
          onClick={handleFullscreen}
          title="Open fullscreen"
          size="sm"
        />
        {showPinControls && (
          <PinButton isPinned={isPinned} handlePinToggle={handlePinToggle} />
        )}
      </CardControls>
    );
  }
);

type TScreenShareCardProps = {
  userId: number;
  isPinned?: boolean;
  onPin: () => void;
  onUnpin: () => void;
  className?: string;
  showPinControls: boolean;
};

const ScreenShareCard = memo(
  ({
    userId,
    isPinned = false,
    onPin,
    onUnpin,
    className,
    showPinControls = true
  }: TScreenShareCardProps) => {
    const user = useUserById(userId);
    const { screenShareRef, hasScreenShareStream } = useVoiceRefs(userId);

    const {
      containerRef,
      isZoomEnabled,
      zoom,
      position,
      isDragging,
      handleToggleZoom,
      handleWheel,
      handleMouseDown,
      handleMouseMove,
      handleMouseUp,
      getCursor,
      resetZoom
    } = useScreenShareZoom();

    const [isFullscreen, setIsFullscreen] = useState(false);

    const handlePinToggle = useCallback(() => {
      if (isPinned) {
        onUnpin?.();
        resetZoom();
      } else {
        onPin?.();
      }
    }, [isPinned, onPin, onUnpin, resetZoom]);

    const handleFullscreen = useCallback(() => {
      setIsFullscreen(true);
    }, []);

    const handleCloseFullscreen = useCallback(() => {
      setIsFullscreen(false);
    }, []);

    if (!user || !hasScreenShareStream) return null;

    return (
      <div
        ref={containerRef}
        className={cn(
          'relative bg-card rounded-lg overflow-hidden group',
          'flex items-center justify-center',
          'w-full h-full',
          'border border-border',
          className
        )}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          cursor: getCursor()
        }}
      >
        <CardGradient />

        <ScreenShareControls
          isPinned={isPinned}
          isZoomEnabled={isZoomEnabled}
          handlePinToggle={handlePinToggle}
          handleToggleZoom={handleToggleZoom}
          handleFullscreen={handleFullscreen}
          showPinControls={showPinControls}
        />

        {isFullscreen && (
          <FullscreenStreamOverlay
            userId={userId}
            onClose={handleCloseFullscreen}
          />
        )}

        <video
          ref={screenShareRef}
          autoPlay
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-contain bg-black"
          style={{
            transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
            transition: isDragging ? 'none' : 'transform 0.1s ease-out'
          }}
        />

        <div className="absolute bottom-0 left-0 right-0 p-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-2 min-w-0">
            <Monitor className="size-3.5 text-purple-400 flex-shrink-0" />
            <span className="text-white font-medium text-xs truncate">
              {user.name}'s screen
            </span>
            {isZoomEnabled && zoom > 1 && (
              <span className="text-white/70 text-xs ml-auto flex-shrink-0">
                {Math.round(zoom * 100)}%
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }
);

ScreenShareCard.displayName = 'ScreenShareCard';

export { ScreenShareCard };
