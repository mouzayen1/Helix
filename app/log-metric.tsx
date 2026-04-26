// Log metric — spec v2.0 §10. Modal. Insert a single reading.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconClose } from '../components/Icons';
import { METRIC_KINDS, insertMetric } from '../lib/db';
import { useTheme } from '../theme/ThemeContext';
import { font, radius, space } from '../theme/tokens';

export default function LogMetricModal() {
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState<string>('weight');
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const selected = METRIC_KINDS.find((k) => k.id === kind)!;
  const parsed = parseFloat(value);
  const valid = !isNaN(parsed) && parsed > 0;

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await insertMetric({
        kind,
        value: parsed,
        unit: selected.unit,
        note: note.trim() || undefined,
      });
      router.back();
    } catch {
      setSaving(false);
    }
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
