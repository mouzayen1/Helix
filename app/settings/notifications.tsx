// Notifications settings — editorial rebuild.
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EditorialHeadline } from '../../components/editorial/EditorialHeadline';
import { EyebrowLabel } from '../../components/editorial/EyebrowLabel';
import { HairlineRow } from '../../components/editorial/HairlineRow';
import { useEditorialTheme } from '../../lib/design/theme';
import {
  DEFAULT_NOTIF_PREFS,
  ensurePermission,
  getNotifPrefs,
  scheduleAllSafe,
  setNotifPrefs,
  type NotifPrefs,
} from '../../lib/notifications';

export default function NotificationsScreen() {
  const ed = useEditorialTheme();
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
    <View style={{ flex: 1, backgroundColor: ed.colors.bg }}>
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingBottom: 12,
          paddingHorizontal: 24,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text
            style={{
              fontFamily: ed.fraunces('Fraunces_300Light'),
              fontSize: 26,
              color: ed.colors.ink2,
              lineHeight: 26,
            }}
          >
            ←
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 64 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: 24 }}>
          <Text
            style={{
              fontFamily: ed.typography.eyebrow.fontFamily,
              fontSize: ed.typography.eyebrow.fontSize,
              letterSpacing: ed.typography.eyebrow.letterSpacing,
              color: ed.colors.ink3,
              textTransform: 'uppercase',
              marginBottom: 14,
            }}
          >
            Notifications
          </Text>
          <EditorialHeadline size="title1">{`Reminders, *quietly*.`}</EditorialHeadline>
        </View>

        {loading ? (
          <Text
            style={{
              paddingHorizontal: 24,
              marginTop: 28,
              fontFamily: ed.typography.dataMd.fontFamily,
              fontSize: ed.typography.dataMd.fontSize,
              color: ed.colors.ink3,
            }}
          >
            Loading…
          </Text>
        ) : (
          <>
            {/* Mode */}
            <View style={{ marginTop: 32, paddingHorizontal: 24 }}>
              <EyebrowLabel withRule>Mode</EyebrowLabel>
              <View style={{ marginTop: 4 }}>
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
                ).map((o, idx, arr) => {
                  const on = prefs.mode === o.key;
                  return (
                    <View key={o.key}>
                      <Pressable
                        onPress={() => persist({ mode: o.key })}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: on }}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'flex-start',
                          gap: 14,
                          paddingVertical: 16,
                        }}
                      >
                        <View
                          style={{
                            width: 18,
                            height: 18,
                            marginTop: 4,
                            borderRadius: 9,
                            borderWidth: 1,
                            borderColor: on ? ed.colors.brand : ed.colors.lineStrong,
                            backgroundColor: 'transparent',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {on ? (
                            <View
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: 4,
                                backgroundColor: ed.colors.brand,
                              }}
                            />
                          ) : null}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              fontFamily: ed.fraunces('Fraunces_400Regular'),
                              fontSize: 17,
                              letterSpacing: -0.2,
                              color: ed.colors.ink1,
                            }}
                          >
                            {o.label}
                          </Text>
                          <Text
                            style={{
                              marginTop: 4,
                              fontFamily: ed.typography.bodySm.fontFamily,
                              fontSize: ed.typography.bodySm.fontSize,
                              color: ed.colors.ink3,
                            }}
                          >
                            {o.desc}
                          </Text>
                        </View>
                      </Pressable>
                      {idx < arr.length - 1 ? <HairlineRow /> : null}
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Categories */}
            <View
              style={{ marginTop: 28, paddingHorizontal: 24, opacity: masterOff ? 0.45 : 1 }}
            >
              <EyebrowLabel withRule>Categories</EyebrowLabel>
              <ToggleRow
                label="Dose reminders"
                desc="From your active cycle schedule."
                value={prefs.sub.doseReminders}
                disabled={masterOff}
                onChange={(v) => persist({ sub: { ...prefs.sub, doseReminders: v } })}
              />
              <HairlineRow />
              <ToggleRow
                label="Vial expiry warnings"
                desc="3 days before a reconstituted vial expires."
                value={prefs.sub.vialExpiry}
                disabled={masterOff || prefs.mode === 'dose'}
                onChange={(v) => persist({ sub: { ...prefs.sub, vialExpiry: v } })}
              />
              <HairlineRow />
              <ToggleRow
                label="Phase transitions"
                desc="Day before loading / maintenance / taper switches."
                value={prefs.sub.phaseTransitions}
                disabled={masterOff || prefs.mode === 'dose'}
                onChange={(v) => persist({ sub: { ...prefs.sub, phaseTransitions: v } })}
              />
              <HairlineRow />
              <ToggleRow
                label="Missed-dose nudge"
                desc="Daily 8pm reminder if nothing was logged."
                value={prefs.sub.missedDose}
                disabled={masterOff || prefs.mode === 'dose'}
                onChange={(v) => persist({ sub: { ...prefs.sub, missedDose: v } })}
              />
            </View>

            {/* Preferred times */}
            <View
              style={{ marginTop: 28, paddingHorizontal: 24, opacity: masterOff ? 0.45 : 1 }}
            >
              <EyebrowLabel withRule>Preferred times</EyebrowLabel>
              {(['morning', 'evening', 'pre-bed', 'pre-workout'] as const).map((key, idx, arr) => (
                <View key={key}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 14,
                      gap: 12,
                    }}
                  >
                    <Text
                      style={{
                        flex: 1,
                        fontFamily: ed.fraunces('Fraunces_400Regular'),
                        fontSize: 17,
                        letterSpacing: -0.2,
                        color: ed.colors.ink1,
                        textTransform: 'capitalize',
                      }}
                    >
                      {key}
                    </Text>
                    <TimeField
                      value={prefs.times[key]}
                      onChange={(v) => persist({ times: { ...prefs.times, [key]: v } })}
                      disabled={masterOff}
                    />
                  </View>
                  {idx < arr.length - 1 ? <HairlineRow /> : null}
                </View>
              ))}
            </View>

            {/* Quiet hours */}
            <View
              style={{ marginTop: 28, paddingHorizontal: 24, opacity: masterOff ? 0.45 : 1 }}
            >
              <EyebrowLabel withRule>Quiet hours</EyebrowLabel>
              <Text
                style={{
                  marginTop: 10,
                  fontFamily: ed.typography.bodySm.fontFamily,
                  fontSize: ed.typography.bodySm.fontSize,
                  color: ed.colors.ink3,
                }}
              >
                No notifications during this window. Leave both blank to disable.
              </Text>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: ed.typography.labelSm.fontFamily,
                      fontSize: ed.typography.labelSm.fontSize,
                      letterSpacing: ed.typography.labelSm.letterSpacing,
                      color: ed.colors.ink3,
                      textTransform: 'uppercase',
                      marginBottom: 6,
                    }}
                  >
                    Start
                  </Text>
                  <TimeField
                    value={prefs.quietHours?.start ?? ''}
                    onChange={(v) =>
                      persist({
                        quietHours: v && prefs.quietHours?.end
                          ? { start: v, end: prefs.quietHours.end }
                          : v
                          ? { start: v, end: '07:00' }
                          : null,
                      })
                    }
                    disabled={masterOff}
                    fullWidth
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: ed.typography.labelSm.fontFamily,
                      fontSize: ed.typography.labelSm.fontSize,
                      letterSpacing: ed.typography.labelSm.letterSpacing,
                      color: ed.colors.ink3,
                      textTransform: 'uppercase',
                      marginBottom: 6,
                    }}
                  >
                    End
                  </Text>
                  <TimeField
                    value={prefs.quietHours?.end ?? ''}
                    onChange={(v) =>
                      persist({
                        quietHours: v && prefs.quietHours?.start
                          ? { start: prefs.quietHours.start, end: v }
                          : v
                          ? { start: '22:00', end: v }
                          : null,
                      })
                    }
                    disabled={masterOff}
                    fullWidth
                  />
                </View>
              </View>
            </View>

            <Text
              style={{
                paddingHorizontal: 24,
                marginTop: 36,
                fontFamily: ed.typography.labelSm.fontFamily,
                fontSize: ed.typography.labelSm.fontSize,
                letterSpacing: ed.typography.labelSm.letterSpacing,
                color: ed.colors.ink3,
                textTransform: 'uppercase',
                lineHeight: 16,
              }}
            >
              All Helix notifications are local. Reminders are rebuilt on app launch for the next 7 days.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
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
  const ed = useEditorialTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        gap: 12,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: ed.fraunces('Fraunces_400Regular'),
            fontSize: 17,
            letterSpacing: -0.2,
            color: ed.colors.ink1,
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            marginTop: 3,
            fontFamily: ed.typography.bodySm.fontFamily,
            fontSize: ed.typography.bodySm.fontSize,
            color: ed.colors.ink3,
          }}
        >
          {desc}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: ed.colors.lineStrong, true: ed.colors.brand }}
        thumbColor={ed.colors.bg}
      />
    </View>
  );
}

function TimeField({
  value,
  onChange,
  disabled,
  fullWidth,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  fullWidth?: boolean;
}) {
  const ed = useEditorialTheme();
  return (
    <TextInput
      value={value}
      onChangeText={(v) => onChange(v.slice(0, 5))}
      editable={!disabled}
      placeholder="HH:MM"
      placeholderTextColor={ed.colors.ink4}
      keyboardType="numbers-and-punctuation"
      selectionColor={ed.colors.brand}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: ed.colors.lineStrong,
        fontFamily: ed.typography.dataMd.fontFamily,
        fontSize: 14,
        color: ed.colors.ink1,
        width: fullWidth ? undefined : 88,
        textAlign: 'center',
      }}
    />
  );
}
