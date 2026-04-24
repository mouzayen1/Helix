// Settings → Notifications. v1.1 Phase 6.
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconChevronLeft } from '../../components/Icons';
import {
  DEFAULT_NOTIF_PREFS,
  ensurePermission,
  getNotifPrefs,
  scheduleAllSafe,
  setNotifPrefs,
  type NotifPrefs,
} from '../../lib/notifications';
import { useTheme } from '../../theme/ThemeContext';
import { font, radius, space } from '../../theme/tokens';

export default function NotificationsScreen() {
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_NOTIF_PREFS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getNotifPrefs().then((p) => {
      setPrefs(p);
      setLoading(false);
    });
  }, []);

  const persist = async (patch: Partial<NotifPrefs>) => {
    const next = await setNotifPrefs(patch);
    setPrefs(next);
    if (next.mode !== 'off') {
      await ensurePermission();
    }
    await scheduleAllSafe();
  };

  const masterOff = prefs.mode === 'off';

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View
        style={{
          paddingTop: insets.top + space.md,
          paddingBottom: space.md,
          paddingHorizontal: space.xl,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <IconChevronLeft size={18} color={t.ink} />
        </Pressable>
        <Text style={{ fontSize: 20, fontFamily: font.sansBold, color: t.ink }}>
          Notifications
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space['2xl'] }}>
        {loading ? (
          <Text style={{ paddingHorizontal: space.xl, color: t.ink3 }}>Loading…</Text>
        ) : (
          <>
            {/* Master mode */}
            <SectionLabel label="Mode" />
            <View style={{ marginHorizontal: space.xl, gap: 8 }}>
              {(
                [
                  { key: 'off', label: 'Off', desc: 'No notifications.' },
                  {
                    key: 'dose',
                    label: 'Dose reminders only',
                    desc: 'Schedule-based nudges from your active cycle.',
                  },
                  {
                    key: 'all',
                    label: 'All alerts',
                    desc: 'Dose reminders, expiry warnings, missed-dose nudges.',
                  },
                ] as const
              ).map((o) => {
                const on = prefs.mode === o.key;
                return (
                  <Pressable
                    key={o.key}
                    onPress={() => persist({ mode: o.key })}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    style={{
                      borderWidth: 1,
                      borderColor: on ? t.accent : t.line,
                      backgroundColor: on ? t.accentSoft : t.surface,
                      padding: space.md,
                      borderRadius: radius.md,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontFamily: font.sansSemi,
                        color: on ? t.accentInk : t.ink,
                      }}
                    >
                      {o.label}
                    </Text>
                    <Text style={{ fontSize: 12, color: t.ink3, marginTop: 2 }}>{o.desc}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Sub-toggles */}
            <SectionLabel label="Categories" />
            <View
              style={{
                marginHorizontal: space.xl,
                backgroundColor: t.surface,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: t.line,
                overflow: 'hidden',
                opacity: masterOff ? 0.45 : 1,
              }}
            >
              <ToggleRow
                label="Dose reminders"
                desc="From your active cycle schedule."
                value={prefs.sub.doseReminders}
                disabled={masterOff}
                onChange={(v) => persist({ sub: { ...prefs.sub, doseReminders: v } })}
              />
              <ToggleRow
                label="Vial expiry warnings"
                desc="3 days before a reconstituted vial expires."
                value={prefs.sub.vialExpiry}
                disabled={masterOff || prefs.mode === 'dose'}
                onChange={(v) => persist({ sub: { ...prefs.sub, vialExpiry: v } })}
              />
              <ToggleRow
                label="Phase transitions"
                desc="Day before loading / maintenance / taper switches."
                value={prefs.sub.phaseTransitions}
                disabled={masterOff || prefs.mode === 'dose'}
                onChange={(v) => persist({ sub: { ...prefs.sub, phaseTransitions: v } })}
              />
              <ToggleRow
                label="Missed-dose nudge"
                desc="Daily 8pm reminder if nothing was logged."
                value={prefs.sub.missedDose}
                disabled={masterOff || prefs.mode === 'dose'}
                onChange={(v) => persist({ sub: { ...prefs.sub, missedDose: v } })}
              />
            </View>

            {/* Preferred times */}
            <SectionLabel label="Preferred times" />
            <View
              style={{
                marginHorizontal: space.xl,
                backgroundColor: t.surface,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: t.line,
                gap: 8,
                padding: space.md,
                opacity: masterOff ? 0.45 : 1,
              }}
            >
              {(['morning', 'evening', 'pre-bed', 'pre-workout'] as const).map((key) => (
                <TimeRow
                  key={key}
                  label={key}
                  value={prefs.times[key]}
                  disabled={masterOff}
                  onChange={(v) => persist({ times: { ...prefs.times, [key]: v } })}
                />
              ))}
            </View>

            {/* Quiet hours */}
            <SectionLabel label="Quiet hours" />
            <View
              style={{
                marginHorizontal: space.xl,
                backgroundColor: t.surface,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: t.line,
                padding: space.md,
                gap: 10,
                opacity: masterOff ? 0.45 : 1,
              }}
            >
              <Text style={{ color: t.ink3, fontSize: 12 }}>
                No notifications during this window. Leave both fields blank to disable.
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TimeField
                  label="Start"
                  value={prefs.quietHours?.start ?? ''}
                  disabled={masterOff}
                  onChange={(v) =>
                    persist({
                      quietHours: v && prefs.quietHours?.end
                        ? { start: v, end: prefs.quietHours.end }
                        : v
                        ? { start: v, end: '07:00' }
                        : null,
                    })
                  }
                />
                <TimeField
                  label="End"
                  value={prefs.quietHours?.end ?? ''}
                  disabled={masterOff}
                  onChange={(v) =>
                    persist({
                      quietHours: v && prefs.quietHours?.start
                        ? { start: prefs.quietHours.start, end: v }
                        : v
                        ? { start: '22:00', end: v }
                        : null,
                    })
                  }
                />
              </View>
            </View>

            <Text
              style={{
                paddingHorizontal: space.xl,
                marginTop: space.lg,
                fontSize: 11,
                color: t.ink4,
                lineHeight: 16,
              }}
            >
              All Helix notifications are local. Nothing is scheduled on a server.
              Reminders are rebuilt on app launch for the next 7 days.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function SectionLabel({ label }: { label: string }) {
  const { t } = useTheme();
  return (
    <Text
      style={{
        paddingHorizontal: space.xl,
        marginTop: space.xl,
        marginBottom: space.sm,
        fontSize: 11,
        letterSpacing: 1.2,
        color: t.ink3,
        fontFamily: font.sansSemi,
        textTransform: 'uppercase',
      }}
    >
      {label}
    </Text>
  );
}

function ToggleRow({
  label,
  desc,
  value,
  onChange,
  disabled,
}: {
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const { t } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: space.md,
        borderTopWidth: 1,
        borderTopColor: t.line,
        gap: 10,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontFamily: font.sansSemi, color: t.ink }}>{label}</Text>
        <Text style={{ fontSize: 12, color: t.ink3, marginTop: 2 }}>{desc}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: t.surfaceAlt, true: t.accent }}
      />
    </View>
  );
}

function TimeRow({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Text style={{ flex: 1, color: t.ink, fontSize: 14, textTransform: 'capitalize' }}>
        {label}
      </Text>
      <TimeField label="HH:MM" value={value} onChange={onChange} disabled={disabled} />
    </View>
  );
}

function TimeField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={(v) => {
        // Allow empty; otherwise lightly normalise to HH:MM (max 5 chars)
        const trimmed = v.slice(0, 5);
        onChange(trimmed);
      }}
      editable={!disabled}
      placeholder={label}
      placeholderTextColor={t.ink4}
      keyboardType="numbers-and-punctuation"
      style={{
        borderWidth: 1,
        borderColor: t.line,
        borderRadius: radius.sm,
        paddingVertical: 6,
        paddingHorizontal: 10,
        fontSize: 13,
        fontFamily: font.mono,
        color: t.ink,
        width: 80,
        textAlign: 'center',
        backgroundColor: t.bg,
      }}
    />
  );
}
