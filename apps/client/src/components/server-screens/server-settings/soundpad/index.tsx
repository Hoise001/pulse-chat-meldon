import { getAccessToken } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useFilePicker } from '@/hooks/use-file-picker';
import { Trash2, Upload, Volume2 } from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

type Sound = { name: string; file: string };

const Soundpad = memo(() => {
  const [sounds, setSounds] = useState<Sound[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const openFilePicker = useFilePicker();

  const fetchSounds = useCallback(async () => {
    try {
      const res = await fetch('/api/soundpad/list');
      const data = await res.json();
      setSounds(data);
    } catch (e) {
      console.error('Failed to fetch sounds:', e);
    }
  }, []);

  useEffect(() => {
    fetchSounds();
  }, [fetchSounds]);

  const uploadSound = useCallback(async () => {
    const files = await openFilePicker('audio/*', true);
    if (!files || files.length === 0) return;
    
    setIsUploading(true);
    const token = await getAccessToken();

    try {
      for (const file of files) {
        const res = await fetch('/api/soundpad/upload', {
          method: 'POST',
          headers: {
            'x-token': token || '',
            'x-file-name': file.name,
            'Content-Type': file.type,
          },
          body: file,
        });
        
        if (!res.ok) throw new Error(`Upload failed for ${file.name}`);
      }
      await fetchSounds();
      toast.success('Sound(s) uploaded successfully!');
    } catch (e) {
      console.error(e);
      toast.error('Failed to upload sound');
    } finally {
      setIsUploading(false);
    }
  }, [openFilePicker, fetchSounds]);

  const deleteSound = useCallback(async (file: string) => {
    const token = await getAccessToken();
    try {
      const res = await fetch(`/api/soundpad/delete?file=${encodeURIComponent(file)}`, {
        method: 'DELETE',
        headers: {
          'x-token': token || '',
        },
      });
      
      if (!res.ok) throw new Error('Delete failed');
      
      await fetchSounds();
      toast.success('Sound deleted');
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete sound');
    }
  }, [fetchSounds]);

  return (
    <div className="flex gap-6">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold">Soundpad</h3>
            <p className="text-sm text-muted-foreground">
              Manage sounds available in the voice channel soundpad
            </p>
          </div>
          <Button onClick={uploadSound} disabled={isUploading}>
            <Upload className="h-4 w-4 mr-2" />
            {isUploading ? 'Uploading...' : 'Upload Sound'}
          </Button>
        </div>

        {sounds.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Volume2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <h3 className="font-medium mb-1">No sounds yet</h3>
              <p className="text-sm">Upload MP3, WAV or OGG files to get started</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {sounds.map(sound => (
              <div
                key={sound.file}
                className="flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-secondary/30"
              >
                <div className="flex items-center gap-3">
                  <Volume2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{sound.name}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => new Audio(`/public/soundpad/${sound.file}`).play()}
                  >
                    Preview
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteSound(sound.file)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export { Soundpad };
