export const MENTION_USER_EVENT = 'pulse:mention-user';

export const dispatchMentionUser = (userId: number, username: string) => {
  window.dispatchEvent(
    new CustomEvent(MENTION_USER_EVENT, {
      detail: { userId, username }
    })
  );
};
