import { useSelector } from 'react-redux';
import type { IRootState } from '../store';
import {
  dmActiveCallsSelector,
  dmCallByChannelIdSelector,
  dmChannelsSelector,
  dmMessagesSelector,
  dmsLoadingSelector,
  dmTypingUsersSelector,
  ownDmCallChannelIdSelector,
  selectedDmChannelIdSelector,
  selectedDmChannelSelector
} from './selectors';

export const useDmChannels = () => useSelector(dmChannelsSelector);

export const useSelectedDmChannelId = () =>
  useSelector(selectedDmChannelIdSelector);

export const useSelectedDmChannel = () =>
  useSelector(selectedDmChannelSelector);

export const useDmMessages = (dmChannelId: number) =>
  useSelector((state: IRootState) => dmMessagesSelector(state, dmChannelId));

export const useDmsLoading = () => useSelector(dmsLoadingSelector);

export const useDmActiveCalls = () => useSelector(dmActiveCallsSelector);

export const useDmCall = (dmChannelId: number) =>
  useSelector((state: IRootState) =>
    dmCallByChannelIdSelector(state, dmChannelId)
  );

export const useOwnDmCallChannelId = () =>
  useSelector(ownDmCallChannelIdSelector);

export const useDmTypingUsers = (dmChannelId: number) =>
  useSelector((state: IRootState) =>
    dmTypingUsersSelector(state, dmChannelId)
  );
