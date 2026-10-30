import { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Text } from '@/components/text';
import { Stack, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api, Property, CleaningContact, Service, AutomationMode } from '@/lib/api';
import { Screen, TextField, Chip, SegmentedControl, ErrorBanner, LoadingScreen } from '@/components/ui';
import { Button } from '@/components/Button';
import { colors, spacing, typography } from '@/theme';
import { useLanguage } from '@/lib/i18n/language-context';
import { useHostAccess } from '@/lib/access';
import { NoAccess } from '@/components/no-access';

/**
 * Copy of DEFAULT_GUEST_WELCOME_TEMPLATE in
 * apps/api/src/common/utils/guest-welcome.ts — used only to pre-fill the
 * editor when a property has no template saved yet, so the host edits the
 * text that would actually be sent rather than a blank box. The backend
 * remains the source of truth: if these drift, the only effect is which
 * wording a never-customised property starts from.
 */
const DEFAULT_TEMPLATE = `Hi {{guestName}}! Your check-in at {{propertyName}} is confirmed for {{checkInDate}}.

📍 Location: {{mapsLink}}
🚪 Door photos: {{doorPhotos}}
🔑 Gate code: {{gateCode}}
🏠 Apartment: {{apartmentNumber}}
🏢 Floor: {{floor}}
🔐 Door code: {{accessCode}}

🕒 Check-in from {{checkInTime}} · Check-out by {{checkOutTime}}

House rules:
{{houseRules}}

Have a great stay! — Sent via ReadyDar`;

const TEMPLATE_VARIABLES =
  '{{guestName}} {{propertyName}} {{checkInDate}} {{checkOutDate}} {{checkInTime}} {{checkOutTime}} ' +
  '{{mapsLink}} {{doorPhotos}} {{gateCode}} {{apartmentNumber}} {{floor}} {{accessCode}} {{houseRules}}';

// Everything this screen writes is @MinHostRole('MANAGER') on the API.
export default function PropertySettingsScreen() {
  const { isManager } = useHostAccess();
  return isManager ? <PropertySettingsInner /> : <NoAccess />;
}

function PropertySettingsInner() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { t } = useLanguage();
  const ps = t.propertySettings;

  const MODE_OPTIONS: { value: AutomationMode; label: string }[] = [
    { value: 'OFF', label: ps.modeOff },
    { value: 'MANUAL_CONFIRM', label: ps.modeReview },
    { value: 'AUTO', label: ps.modeAuto },
  ];

  const [property, setProperty] = useState<Property | null>(null);
  const [contacts, setContacts] = useState<CleaningContact[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  const [nightlyRate, setNightlyRate] = useState('');
  const [guestWelcomeMode, setGuestWelcomeMode] = useState<AutomationMode>('OFF');
  const [guestWelcomeTemplate, setGuestWelcomeTemplate] = useState('');
  const [access, setAccess] = useState({
    gateCode: '',
    doorAccessCode: '',
    apartmentNumber: '',
    floor: '',
    googleMapsUrl: '',
    checkInTime: '',
    checkOutTime: '',
    houseRules: '',
  });
  const [automationMode, setAutomationMode] = useState<AutomationMode>('OFF');
  const [defaultCleaningContactId, setDefaultCleaningContactId] = useState<string | null>(null);
  const [defaultServiceType, setDefaultServiceType] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const setField = (key: keyof typeof access) => (value: string) => {
    setSaved(false);
    setAccess((prev) => ({ ...prev, [key]: value }));
  };

  const load = useCallback(async () => {
    if (!session || !id) return;
    setError(null);
    try {
      const [p, contactList, serviceList] = await Promise.all([
        api.properties.getOne(id, session.accessToken),
        api.cleaningContacts.list(session.accessToken),
        api.services.list(),
      ]);
      setProperty(p);
      setContacts(contactList);
      setServices(serviceList);
      setNightlyRate(p.nightlyRate != null ? String(p.nightlyRate) : '');
      setGuestWelcomeMode(p.guestWelcomeMode ?? 'OFF');
      setGuestWelcomeTemplate(p.guestWelcomeTemplate?.trim() ? p.guestWelcomeTemplate : DEFAULT_TEMPLATE);
      setAccess({
        gateCode: p.gateCode ?? '',
        doorAccessCode: p.doorAccessCode ?? '',
        apartmentNumber: p.apartmentNumber ?? '',
        floor: p.floor ?? '',
        googleMapsUrl: p.googleMapsUrl ?? '',
        checkInTime: p.checkInTime ?? '',
        checkOutTime: p.checkOutTime ?? '',
        houseRules: p.houseRules ?? '',
      });
      setAutomationMode(p.automationMode ?? 'OFF');
      setDefaultCleaningContactId(p.defaultCleaningContactId ?? null);
      setDefaultServiceType(p.defaultServiceType ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : ps.loadError);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleSave() {
    if (!session || !id) return;
    setError(null);
    setSaved(false);

    const trimmedRate = nightlyRate.trim();
    const parsedRate = trimmedRate === '' ? null : Number(trimmedRate);
    if (parsedRate !== null && (Number.isNaN(parsedRate) || parsedRate < 0)) {
      setError(ps.invalidRate);
      return;
    }

    setIsSaving(true);
    try {
      if (parsedRate !== null) {
        await api.reports.setPropertyRate(id, parsedRate, session.accessToken);
      }
      // Every access field is sent every time, trimmed, with '' meaning
      // "clear it" — the renderer then drops that line from the message.
      // The template is always sent too: the API writes its *default*
      // whenever the field is omitted, which would silently discard a
      // custom wording set on the web.
      await api.automation.setGuestWelcome(
        id,
        {
          guestWelcomeMode,
          guestWelcomeTemplate: guestWelcomeTemplate.trim() || DEFAULT_TEMPLATE,
          gateCode: access.gateCode.trim(),
          doorAccessCode: access.doorAccessCode.trim(),
          apartmentNumber: access.apartmentNumber.trim(),
          floor: access.floor.trim(),
          googleMapsUrl: access.googleMapsUrl.trim(),
          checkInTime: access.checkInTime.trim(),
          checkOutTime: access.checkOutTime.trim(),
          houseRules: access.houseRules.trim(),
        },
        session.accessToken,
      );
      await api.automation.setForProperty(
        id,
        { automationMode, defaultCleaningContactId, defaultServiceType: defaultServiceType ?? undefined },
        session.accessToken,
      );
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : ps.saveError);
    } finally {
      setIsSaving(false);
    }
  }

  const cleaningServices = services.filter((s) => s.category === 'CLEANING');

  if (!property) {
    return error ? (
      <Screen>
        <View style={{ padding: spacing.lg }}>
          <ErrorBanner message={error} onRetry={load} />
        </View>
      </Screen>
    ) : (
      <LoadingScreen />
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: ps.headerTitle, headerBackTitle: t.noAccess.back }} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={typography.h1}>{property.name}</Text>
        <Text style={[typography.bodyMuted, { marginTop: spacing.xs }]}>{ps.subtitle}</Text>

        {error && <ErrorBanner message={error} onRetry={load} />}

        {/* Access details first: these are what change most often (a new
            gate code, a different door code) and they feed every welcome
            message and cleaner turnover message for this property. */}
        <Text style={styles.sectionTitle}>{ps.accessTitle}</Text>
        <Text style={typography.bodyMuted}>{ps.accessBody}</Text>
        <View style={styles.row}>
          <View style={styles.half}>
            <TextField label={ps.gateCode} value={access.gateCode} onChangeText={setField('gateCode')} autoCapitalize="none" />
          </View>
          <View style={styles.half}>
            <TextField label={ps.doorCode} value={access.doorAccessCode} onChangeText={setField('doorAccessCode')} autoCapitalize="none" />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.half}>
            <TextField label={ps.apartmentNumber} value={access.apartmentNumber} onChangeText={setField('apartmentNumber')} />
          </View>
          <View style={styles.half}>
            <TextField label={ps.floor} value={access.floor} onChangeText={setField('floor')} />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.half}>
            <TextField label={ps.checkInTime} value={access.checkInTime} onChangeText={setField('checkInTime')} placeholder="15:00" />
          </View>
          <View style={styles.half}>
            <TextField label={ps.checkOutTime} value={access.checkOutTime} onChangeText={setField('checkOutTime')} placeholder="11:00" />
          </View>
        </View>
        <TextField
          label={ps.mapsLink}
          value={access.googleMapsUrl}
          onChangeText={setField('googleMapsUrl')}
          autoCapitalize="none"
          keyboardType="url"
          placeholder="https://maps.google.com/…"
        />
        <TextField label={ps.houseRules} value={access.houseRules} onChangeText={setField('houseRules')} multiline numberOfLines={4} />

        {/* Always shown — it used to be hidden unless automatic sending was
            on, but the wording is used for manual sends from the Guests
            screen too, so a host with automation off could never edit it. */}
        <Text style={styles.sectionTitle}>{ps.welcomeTitle}</Text>
        <Text style={typography.bodyMuted}>{ps.welcomeBody}</Text>
        <Text style={styles.fieldLabel}>{ps.welcomeModeLabel}</Text>
        <SegmentedControl value={guestWelcomeMode} onChange={setGuestWelcomeMode} options={MODE_OPTIONS} />

        <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>{ps.templateTitle}</Text>
        <Text style={typography.caption}>{ps.templateBody}</Text>
        <View style={{ marginTop: spacing.sm }}>
          <TextField
            label={ps.templateLabel}
            value={guestWelcomeTemplate}
            onChangeText={(v) => {
              setSaved(false);
              setGuestWelcomeTemplate(v);
            }}
            multiline
            numberOfLines={12}
          />
        </View>
        <Text style={typography.caption}>
          {ps.variablesHint} {TEMPLATE_VARIABLES}
        </Text>
        {guestWelcomeTemplate !== DEFAULT_TEMPLATE && (
          <Pressable onPress={() => setGuestWelcomeTemplate(DEFAULT_TEMPLATE)} hitSlop={8} style={{ marginTop: spacing.sm }}>
            <Text style={styles.link}>{ps.resetTemplate}</Text>
          </Pressable>
        )}

        <Text style={styles.sectionTitle}>{ps.turnoverTitle}</Text>
        <Text style={typography.bodyMuted}>{ps.turnoverBody}</Text>
        <View style={{ marginTop: spacing.md }}>
          <SegmentedControl value={automationMode} onChange={setAutomationMode} options={MODE_OPTIONS} />
        </View>
        {/* The default contact is also who "Notify cleaner" on Home's
            tomorrow-checkout card messages, so it's offered whatever the
            automation mode — not only when automation is on. */}
        <Text style={styles.fieldLabel}>{ps.defaultContact}</Text>
        {contacts.length === 0 ? (
          <Text style={typography.bodyMuted}>{ps.noContacts}</Text>
        ) : (
          <View style={styles.chipRow}>
            {contacts.map((c) => (
              <Chip
                key={c.id}
                label={c.name}
                active={defaultCleaningContactId === c.id}
                onPress={() => setDefaultCleaningContactId(defaultCleaningContactId === c.id ? null : c.id)}
              />
            ))}
          </View>
        )}
        {automationMode !== 'OFF' && cleaningServices.length > 0 && (
          <>
            <Text style={styles.fieldLabel}>{ps.defaultService}</Text>
            <View style={styles.chipRow}>
              {cleaningServices.map((s) => (
                <Chip
                  key={s.id}
                  label={s.name}
                  active={defaultServiceType === s.type}
                  onPress={() => setDefaultServiceType(defaultServiceType === s.type ? null : s.type)}
                />
              ))}
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>{ps.pricingTitle}</Text>
        <Text style={typography.bodyMuted}>{ps.pricingBody}</Text>
        <View style={{ marginTop: spacing.md }}>
          <TextField
            label={ps.nightlyRate}
            value={nightlyRate}
            onChangeText={setNightlyRate}
            keyboardType="numeric"
            placeholder={ps.nightlyRatePlaceholder}
          />
        </View>

        {saved && !error && (
          <View style={styles.successBox}>
            <Text style={styles.successText}>{ps.saved}</Text>
          </View>
        )}
        <Button
          label={isSaving ? ps.saving : ps.save}
          onPress={handleSave}
          loading={isSaving}
          style={{ marginTop: spacing.lg }}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  sectionTitle: { ...typography.h2, marginTop: spacing.xl, marginBottom: spacing.xs },
  fieldLabel: { ...typography.bodyMuted, fontWeight: '600', marginBottom: spacing.xs, marginTop: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  half: { flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  link: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  successBox: { backgroundColor: colors.successBg, borderRadius: 10, padding: spacing.sm, marginTop: spacing.lg },
  successText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
});
