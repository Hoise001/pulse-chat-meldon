import { PaginatedTable } from '@/components/paginated-table';
import type { TJoinedInvite } from '@pulse/shared';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { TableInvite } from './table-invite';

type TInvitesTableProps = {
  invites: TJoinedInvite[];
  refetch: () => void;
};

const InvitesTable = memo(({ invites, refetch }: TInvitesTableProps) => {
  const { t } = useTranslation();
  const searchFilter = useCallback(
    (invite: TJoinedInvite, searchTerm: string) => {
      const query = searchTerm.toLowerCase();

      return (
        invite.code.toLowerCase().includes(query) ||
        invite.creator.name.toLowerCase().includes(query)
      );
    },
    []
  );

  return (
    <PaginatedTable
      items={invites}
      renderRow={(invite) => (
        <TableInvite key={invite.id} invite={invite} refetch={refetch} />
      )}
      searchFilter={searchFilter}
      headerColumns={
        <>
          <div>{t('serverSettings.invites.table.code')}</div>
          <div>{t('serverSettings.invites.table.creator')}</div>
          <div>{t('serverSettings.invites.table.uses')}</div>
          <div>{t('serverSettings.invites.table.expires')}</div>
          <div>{t('serverSettings.invites.table.created')}</div>
          <div>{t('serverSettings.invites.table.status')}</div>
          <div>{t('serverSettings.invites.table.actions')}</div>
        </>
      }
      gridCols="grid-cols-[180px_60px_80px_100px_140px_80px_80px]"
      itemsPerPage={8}
      searchPlaceholder={t('serverSettings.invites.searchPlaceholder')}
      emptyMessage={t('serverSettings.invites.emptyMessage')}
    />
  );
});

export { InvitesTable };
