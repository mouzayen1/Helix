// Log metric — editorial rebuild. Same insertMetric flow; visual layer
// is the editorial modal pattern: × close, mono uppercase title, save
// link in mono brass, serif headline, sharp-corner kind chips, large
// serif value entry, hairline-framed note.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DateTimeField, isSameLocalDay } from '../components/DateTimeField';
import { EditorialHeadline } from '../components/editorial/EditorialHeadline';
import { EyebrowLabel } from '../components/editorial/EyebrowLabel';
import { useEditorialTheme } from '../lib/design/theme';
import { insertMetric, listMetrics, METRIC_KINDS } from '../lib/db';
import { haptic } from '../lib/haptics';

export default function LogMetricModal() {
  const ed = useEditorialTheme();
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

  // Wrapped in performSave so the duplicate-warning prompt can chain in.
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
    } catch {
      setSaving(false);
      haptic.error();
    }
  };

  const save = async () => {
    if (!valid || saving) return;
    // Same-day duplicate warning. First-of-day saves pass through silently.
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
            { text: 'Log anyway', onPress: () => void performSave() },
          ]
        );
        return;
      }
    } catch {
      // Lookup failure shouldn't block the save — fall through.
    }
    void performSave();
  };

  return (
    <View style={{ flex: 1, backgroundColor: ed.colors.bg }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
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
            ×
          </Text>
        </Pressable>
        <Text
          style={{
            fontFamily: ed.typography.label.fontFamily,
            fontSize: ed.typography.label.fontSize,
            letterSpacing: ed.typography.label.letterSpacing,
            color: ed.colors.ink3,
            textTransform: 'uppercase',
          }}
        >
          Log metric
        </Text>
        <Pressable onPress={save} disabled={!valid || saving} hitSlop={10}>
          <Text
            style={{
              fontFamily: ed.typography.label.fontFamily,
              fontSize: ed.typography.label.fontSize,
              letterSpacing: ed.typography.label.letterSpacing,
              color: !valid || saving ? ed.colors.ink3 : ed.colors.brand,
              textTransform: 'uppercase',
            }}
          >
            {saving ? 'Saving' : 'Save'}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 64 }}
      >
        <EditorialHeadline size="title1">{`A *new* reading.`}</EditorialHeadline>

        <View style={{ marginTop: 32 }}>
          <EyebrowLabel withRule>Metric</EyebrowLabel>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
            {METRIC_KINDS.map((k) => {
              const active = k.id === kind;
              return (
                <Pressable
                  key={k.id}
                  onPress={() => setKind(k.id)}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    backgroundColor: active ? ed.colors.ink1 : 'transparent',
                    borderWidth: 1,
                    borderColor: active ? ed.colors.ink1 : ed.colors.lineStrong,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: ed.typography.labelSm.fontFamily,
                      fontSize: ed.typography.labelSm.fontSize,
                      letterSpacing: ed.typography.labelSm.letterSpacing,
                      color: active ? ed.colors.bg : ed.colors.ink2,
                      textTransform: 'uppercase',
                    }}
                  >
                    {k.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ marginTop: 32 }}>
          <EyebrowLabel withRule>{`Value · ${selected.unit}`}</EyebrowLabel>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', paddingVertical: 16 }}>
            <TextInput
              value={value}
              onChangeText={setValue}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={ed.colors.ink4}
              autoFocus
              selectionColor={ed.colors.brand}
              style={{
                flex: 1,
                fontFamily: ed.fraunces('Fraunces_300Light'),
                fontSize: 64,
                lineHeight: 64,
                letterSpacing: -2,
                color: ed.colors.ink1,
                padding: 0,
              }}
            />
            <Text
              style={{
                marginLeft: 12,
                fontFamily: ed.typography.label.fontFamily,
                fontSize: ed.typography.label.fontSize,
                letterSpacing: ed.typography.label.letterSpacing,
                color: ed.colors.ink3,
                textTransform: 'uppercase',
              }}
            >
              {selected.unit}
            </Text>
          </View>
        </View>

        <View style={{ marginTop: 24 }}>
          <DateTimeField value={takenAt} onChange={setTakenAt} label="When" />
        </View>

        <View style={{ marginTop: 24 }}>
          <EyebrowLabel withRule>Note · optional</EyebrowLabel>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Context or conditions"
            placeholderTextColor={ed.colors.ink4}
            selectionColor={ed.colors.brand}
            style={{
              marginTop: 14,
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: ed.colors.line,
              fontFamily: ed.typography.bodyMd.fontFamily,
              fontSize: ed.typography.bodyMd.fontSize,
              color: ed.colors.ink1,
            }}
          />
        </View>
      </ScrollView>
    </View>
  );
}
