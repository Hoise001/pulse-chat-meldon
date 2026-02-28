import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip } from '@/components/ui/tooltip';
import { fullDateTime } from '@/helpers/time-format';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Calendar,
  ClipboardList,
  Clock,
  Gavel,
  Globe,
  IdCard,
  Network
} from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useModViewContext } from '../context';

type TRowProps = {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  details?: string;
};

const Row = memo(({ icon, label, value, details }: TRowProps) => {
  let valContent = (
    <span className="text-sm text-muted-foreground truncate max-w-[160px]">
      {value}
    </span>
  );

  if (details) {
    valContent = <Tooltip content={details}>{valContent}</Tooltip>;
  }

  return (
    <div className="flex items-center justify-between py-1.5 px-1 gap-4">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {icon}
        <span className="text-sm truncate">{label}</span>
      </div>
      {valContent}
    </div>
  );
});

const Details = memo(() => {
  const { t } = useTranslation();
  const { user, logins } = useModViewContext();
  const lastLogin = logins[0]; // TODO: in the future we might show a list of logins, atm we just show info about the last one

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          {t('modView.details.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="space-y-2">
          <Row
            icon={<IdCard className="h-4 w-4 text-muted-foreground" />}
            label={t('modView.details.userId')}
            value={user.id}
          />

          <Row
            icon={<IdCard className="h-4 w-4 text-muted-foreground" />}
            label={t('modView.details.identity')}
            value={user.supabaseId}
          />

          <Row
            icon={<Network className="h-4 w-4 text-muted-foreground" />}
            label={t('modView.details.ipAddress')}
            value={lastLogin?.ip || t('modView.details.unknown')}
          />

          <Row
            icon={<Globe className="h-4 w-4 text-muted-foreground" />}
            label={t('modView.details.location')}
            value={`${lastLogin?.country || 'N/A'} - ${lastLogin?.city || 'N/A'}`}
          />

          <Row
            icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
            label={t('modView.details.joinedServer')}
            value={formatDistanceToNow(user.createdAt, { addSuffix: true })}
          />

          <Row
            icon={<Clock className="h-4 w-4 text-muted-foreground" />}
            label={t('modView.details.lastActive')}
            value={formatDistanceToNow(user.lastLoginAt, { addSuffix: true })}
          />

          {user.banned && (
            <>
              <Row
                icon={<Gavel className="h-4 w-4 text-muted-foreground" />}
                label={t('modView.details.banned')}
                value={t('modView.details.yes')}
              />

              <Row
                icon={<Gavel className="h-4 w-4 text-muted-foreground" />}
                label={t('modView.details.banReason')}
                value={user.banReason || t('modView.details.noReasonProvided')}
              />

              <Row
                icon={<Gavel className="h-4 w-4 text-muted-foreground" />}
                label={t('modView.details.bannedAt')}
                value={format(user.bannedAt ?? 0, 'PPP')}
                details={format(user.bannedAt ?? 0, fullDateTime())}
              />
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

export { Details };
