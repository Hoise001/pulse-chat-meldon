import { Button } from '@/components/ui/button';
import { useChannelCan } from '@/features/server/hooks';
import { useCurrentVoiceChannelId } from '@/features/server/channels/hooks';
import { useVoice } from '@/features/server/voice/hooks';
import { useActiveServerId } from '@/features/app/hooks';
import { ChannelPermission } from '@pulse/shared';
import { Volume2 } from 'lucide-react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

type Sound = { name: string; file: string };

export const Soundpad = () => {
  const [open, setOpen] = useState(false);
  const [sounds, setSounds] = useState<Sound[]>([]);
  const [playing, setPlaying] = useState<string | null>(null);
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const voiceChannelId = useCurrentVoiceChannelId();
  const channelCan = useChannelCan(voiceChannelId);
  const { playSoundpadAudio } = useVoice();
  const activeServerId = useActiveServerId();

  useEffect(() => {
    if (!activeServerId) return;
    fetch(`/api/soundpad/list?serverId=${activeServerId}`)
      .then(r => r.json())
      .then(setSounds)
      .catch(() => setSounds([]));
  }, [activeServerId]);

  const handleOpen = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPopupPos({ top: rect.bottom - 260, left: rect.right + 8 });
    }
    setOpen(o => !o);
  }, []);

  const playSound = async (file: string) => {
    if (audioRef.current) audioRef.current.pause();
    const soundPath = activeServerId
      ? `/public/soundpad/${activeServerId}/${file}`
      : `/public/soundpad/${file}`;
    const audio = new Audio(soundPath);
    audio.volume = 0.8;
    audio.play();
    audioRef.current = audio;
    setPlaying(file);
    audio.onended = () => setPlaying(null);
    await playSoundpadAudio(file, activeServerId ?? undefined);
  };

  if (!channelCan(ChannelPermission.SOUNDPAD)) return null;

  return (
    <>
      <Button
        ref={buttonRef}
        variant="ghost"
        size="icon"
        className={`h-8 w-8 rounded-md transition-all duration-200 ${
          open
            ? 'bg-purple-500/15 hover:bg-purple-500/25 text-purple-400'
            : 'bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground'
        }`}
        onClick={handleOpen}
        title="Soundpad"
      >
        <Volume2 className="h-4 w-4" />
      </Button>

      {open && createPortal(
        <div
          className="fixed w-64 bg-popover border border-border rounded-lg shadow-lg p-3 z-[9999]"
          style={{ top: popupPos.top, left: popupPos.left }}
        >
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Soundpad</p>
          {sounds.length === 0 ? (
            <p className="text-xs text-muted-foreground">No sounds available.</p>
          ) : (
            <div className="grid grid-cols-2 gap-1.5 max-h-60 overflow-y-auto">
              {sounds.map(sound => (
                <Button
                  key={sound.file}
                  variant={playing === sound.file ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs truncate"
                  onClick={() => playSound(sound.file)}
                >
                  {sound.name}
                </Button>
              ))}
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
};
