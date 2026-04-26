// Log metric — spec v2.0 §10. Modal. Insert a single reading.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DateTimeField, describeBackdate, isSameLocalDay } from '../components/DateTimeField';
import { IconClose } from '../components/Icons';
import { insertMetric, listMetrics, METRIC_KINDS } from '../lib/db';
import { haptic } from '../lib/haptics';
import { useTheme } from '../theme/ThemeContext';
import { font, radius, space } from '../theme/tokens';

export default function LogMetricModal() {
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState<string>('weight');
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [takenAt, setTakenAt] = useState<Date>(new Date());
  const [saving, setSaving] = useState(false);

  const selected = METRIC_KINDS.find((k) => k.id === kind)!;
  const parsed = parseFloat(value);
  const valid = !isNaN(parsed) && parsed > 0;

  // Fires the actual write. Wrapped in a separate function so the
  // duplicate-warning + backdate-confirm prompts can chain into it on user
  // confirmation.
  const performSave = async () => {
    setSaving(true);
    try {
      await insertMetric({
        kind,
        value: parsed,
        unit: selected.unit,
        taken_at: takenAt.toISOString(),
        note: note.trim() || undefined,
      });
      haptic.success();
      router.back();
    } catch (e) {
      setSaving(false);
      haptic.error();
    }
  };

  // Pre-save backdate confirmation: when the chosen taken_at is more than
  // ~6h in the past, surface the human-readable target date with a Save /
  // Cancel choice so the user can back out before the entry lands.
  const confirmBackdateThenSave = () => {
    const minAgo = (Date.now() - takenAt.getTime()) / 60000;
    if (minAgo > 60 * 6) {
      Alert.alert(
        'Save backdated reading?',
        `${describeBackdate(takenAt)}.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save', onPress: () => void performSave() },
        ]
      );
      return;
    }
    void performSave();
  };

  const save = async () => {
    if (!valid || saving) return;
    // Same-day duplicate warning: weighing or reading the same metric twice
    // in one day is unusual; nudge the user before silently appending a
    // second entry. Pulls the most recent N readings of this kind and
    // looks for one that falls on the same local calendar day as takenAt.
    try {
      const recent = await listMetrics(kind, 10);
      const sameDay = recent.find((r) => isSameLocalDay(new Date(r.taken_at), takenAt));
      if (sameDay) {
        const time = new Date(sameDay.taken_at).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        });
        Alert.alert(
          'Already logged today?',
          `You logged ${selected.label} earlier today (${time}, ${sameDay.value} ${selected.unit ?? ''}). Log again?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Log anyway', onPress: () => confirmBackdateThenSave() },
          ]
        );
        return;
      }
    } catch {
      // Lookup failure shouldn't block the save — fall through.
    }
    confirmBackdateThenSave();
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: insets.top + space.sm,
          paddingBottom: space.md,
          paddingHorizontal: space.xl,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <IconClose size={16} color={t.ink3} />
        </Pressable>
        <Text style={{ color: t.ink, fontSize: 15, fontFamily: font.sansSemi }}>Log metric</Text>
        <Pressable onPress={save} disabled={!valid || saving} hitSlop={10}>
          <Text style={{ color: !valid || saving ? t.ink3 : t.accent, fontSize: 14, fontFamily: font.sansSemi }}>
            Save
          </Text>
        </Pressable>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: insets.bottom + 40 }}
      >
        <Text style={{ fontSize: 28, fontFamily: font.sansBold, color: t.ink, letterSpacing: -0.6 }}>
          New reading
        </Text>

        {/* Metric selector */}
        <Text
          style={{
            marginTop: space.xl,
            fontSize: 11,
            color: t.ink3,
            letterSpacing: 0.9,
            fontFamily: font.sansSemi,
            textTransform: 'uppercase',
            marginBottom: 6,
          }}
        >
          Metric
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {METRIC_KINDS.map((k) => {
            const active = k.id === kind;
            return (
              <Pressable
                key={k.id}
                onPress={() => setKind(k.id)}
                style={{
                  paddingVertical: 7,
                  paddingHorizontal: 12,
                  borderRadius: radius.pill,
                  backgroundColor: active ? t.ink : 'transparent',
                  borderWidth: 1,
                  borderColor: active ? t.ink : t.line,
                }}
              >
                <Text style={{ fontSize: 12, color: active ? t.bg : t.ink2, fontFamily: font.sansMed }}>
                  {k.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Value */}
        <Text
          style={{
            marginTop: space.xl,
            fontSize: 11,
            color: t.ink3,
            letterSpacing: 0.9,
            fontFamily: font.sansSemi,
            textTransform: 'uppercase',
            marginBottom: 6,
          }}
        >
          Value ({selected.unit})
        </Text>
        <TextInput
          value={value}
          onChangeText={setValue}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={t.ink4}
          autoFocus
          style={{
            backgroundColor: t.surface,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: t.line,
            padding: space.md,
            color: t.ink,
            fontSize: 32,
            fontFamily: font.monoSemi,
          }}
        />

        {/* When — back-date for forgotten weigh-ins, lab draws, etc. */}
        <View style={{ marginTop: space.md }}>
          <DateTimeField value={takenAt} onChange={setTakenAt} label="When" />
        </View>

        {/* Note */}
        <Text
          style={{
            marginTop: space.md,
            fontSize: 11,
            color: t.ink3,
            letterSpacing: 0.9,
            fontFamily: font.sansSemi,
            textTransform: 'uppercase',
            marginBottom: 6,
          }}
        >
          Note (optional)
        </Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Context or conditions"
          placeholderTextColor={t.ink4}
          style={{
            backgroundColor: t.surface,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: t.line,
            padding: space.md,
            color: t.ink,
            fontSize: 14,
          }}
        />
      </ScrollView>
    </View>
  );
}
