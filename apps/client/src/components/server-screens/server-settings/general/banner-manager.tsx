import { ImagePicker } from '@/components/image-picker';
import { Group } from '@/components/ui/group';
import { uploadFile } from '@/helpers/upload-file';
import { useFilePicker } from '@/hooks/use-file-picker';
import { getTRPCClient } from '@/lib/trpc';
import type { TFile } from '@pulse/shared';
import { memo, useCallback } from 'react';
import { toast } from 'sonner';

type TBannerManagerProps = {
  banner: TFile | null;
  serverId: number | undefined;
  refetch: () => Promise<void>;
};

const BannerManager = memo(({ banner, serverId, refetch }: TBannerManagerProps) => {
  const openFilePicker = useFilePicker();

  const removeBanner = useCallback(async () => {
    if (!serverId) return;
    const trpc = getTRPCClient();
    try {
      await trpc.others.changeBanner.mutate({ serverId, fileId: undefined });
      // Optimistically update Redux joinedServers
      try {
        const { store } = await import('@/features/store');
        const { appSliceActions } = await import('@/features/app/slice');
        const state = store.getState();
        const joinedServers = state.app.joinedServers;
        const updatedServers = joinedServers.map((s) =>
          s.id === serverId ? { ...s, banner: null, logo: s.logo } : s
        );
        store.dispatch(appSliceActions.setJoinedServers(updatedServers));
      } catch {}
      await refetch();
      toast.success('Banner removed successfully!');
    } catch (error) {
      console.error(error);
      toast.error('Could not remove banner. Please try again.');
    }
  }, [refetch, serverId]);

  const onBannerClick = useCallback(async () => {
    if (!serverId) return;
    const trpc = getTRPCClient();
    try {
      const [file] = await openFilePicker('image/*,image/gif');
      const temporaryFile = await uploadFile(file);
      if (!temporaryFile) {
        toast.error('Could not upload file. Please try again.');
        return;
      }
      await trpc.others.changeBanner.mutate({ serverId, fileId: temporaryFile.id });
      // Optimistically update Redux joinedServers
      try {
        const { store } = await import('@/features/store');
        const { appSliceActions } = await import('@/features/app/slice');
        const state = store.getState();
        const joinedServers = state.app.joinedServers;
        const updatedServers = joinedServers.map((s) =>
          s.id === serverId ? { ...s, banner: temporaryFile, logo: s.logo } : s
        );
        store.dispatch(appSliceActions.setJoinedServers(updatedServers));
      } catch {}
      await refetch();
      toast.success('Banner updated successfully!');
    } catch {
      toast.error('Could not update banner. Please try again.');
    }
  }, [openFilePicker, refetch, serverId]);

  return (
    <Group label="Banner">
      <ImagePicker
        image={banner}
        onImageClick={onBannerClick}
        onRemoveImageClick={removeBanner}
        className="w-full h-32"
        accept="image/*,image/gif"
      />
    </Group>
  );
});

export { BannerManager };
