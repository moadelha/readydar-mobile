import { Text } from '@/components/text';
import { useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { useHostAccess } from '@/lib/access';
import { useSetupStrings } from '@/lib/i18n/setup-strings';
import { spacing, typography } from '@/theme';

/**
 * What a host without any property sees on Home and Properties: import from
 * Airbnb first (properties and bookings in one go, owner only on the API),
 * adding one by hand second.
 */
export function FirstRun() {
  const router = useRouter();
  const { isOwner, isManager } = useHostAccess();
  const s = useSetupStrings().firstRun;
  return (
    <>
      <Text style={typography.h3}>{s.title}</Text>
      <Text style={[typography.bodyMuted, { marginTop: spacing.xs }]}>{s.body}</Text>
      {isOwner && <Button label={s.importAirbnb} onPress={() => router.push('/host/hospitable')} style={{ marginTop: spacing.md }} />}
      {isManager && (
        <Button
          label={s.byHand}
          onPress={() => router.push('/host/property/new')}
          variant={isOwner ? 'outline' : 'primary'}
          style={{ marginTop: isOwner ? spacing.sm : spacing.md }}
        />
      )}
    </>
  );
}
