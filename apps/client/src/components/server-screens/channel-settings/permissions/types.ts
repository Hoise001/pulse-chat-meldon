import type { ChannelPermission } from '@pulse/shared';

export type TChannelPermission = {
  permission: ChannelPermission;
  allow: boolean;
};

export type TChannelPermissionType = 'role' | 'user';
