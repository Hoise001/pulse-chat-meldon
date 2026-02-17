import { t } from '../../utils/trpc';
import { getNotificationSettingRoute } from './get-setting';
import { getServerSettingsRoute } from './get-server-settings';
import { markServerAsReadRoute } from './mark-server-as-read';
import { setNotificationSettingRoute } from './set-setting';
import { setServerMuteRoute } from './set-server-mute';
import { setServerNotificationLevelRoute } from './set-server-notification-level';

export const notificationsRouter = t.router({
  getSetting: getNotificationSettingRoute,
  setSetting: setNotificationSettingRoute,
  getServerSettings: getServerSettingsRoute,
  markServerAsRead: markServerAsReadRoute,
  setServerMute: setServerMuteRoute,
  setServerNotificationLevel: setServerNotificationLevelRoute
});
