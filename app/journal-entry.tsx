// Journal entry — spec v2.0 §10. Upsert by entry_date.
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconClose } from '../components/Icons';
import { getJournal, upsertJournal } from '../lib/db';
import { useTheme } from '../theme/ThemeContext';
import { font, radius, space } from '../theme/tokens';

const MOODS = [
  { value: 1, label: 'Rough' },
  { value: 2, label: 'Off' },
  { value: 3, label: 'Neutral' },
  { value: 4, label: 'Good' },
  { value: 5, label: 'Great' },
];

const TAGS = [
  'energetic', 'tired', 'clearheaded', 'foggy', 'euphoric', 'wired',
  'fatigued', 'inflamed', 'itchy', 'nauseous', 'sore', 'recovered',
  'vivid dreams', 'headache', 'good sleep', 'bad sleep',
];

export default function JournalEntryModal() {
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const today = new Date().toISOString().slice(0, 10);

  const [mood, setMood] = useState<number>(3);
  const [energy, setEnergy] = useState(5);
  const [sleepQuality, setSleepQuality] = useState(5);
  const [libido, setLibido] = useState(5);
  const [recovery, setRecovery] = useState(5);
  const [sleepHours, setSleepHours] = useState(7.5);
  const [tags, setTags] = useState<string[]>([]);
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const existing = await getJournal(today);
        if (existing) {
          setMood(existing.mood ?? 3);
          setEnergy(existing.energy ?? 5);
          setSleepQuality(existing.sleep_quality ?? 5);
          setLibido(existing.libido ?? 5);
          setRecovery(existing.recovery ?? 5);
          setSleepHours(existing.sleep_hours ?? 7.5);
          setTags(JSON.parse(existing.tags_json));
          setBody(existing.body ?? '');
        }
      })();
    }, [today])
  );

  const toggleTag = (tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]));
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await upsertJournal({
        entry_date: today,
        mood,
        energy,
        sleep_hours: sleepHours,
        sleep_quality: sleepQuality,
        libido,
        recovery,
        tags,
        body: body.trim() || undefined,
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
        <Text style={{ color: t.ink, fontSize: 15, fontFamily: font.sansSemi }}>Journal</Text>
        <Pressable onPress={save} disabled={saving} hitSlop={10}>
          <Text style={{ color: saving ? t.ink3 : t.accent, fontSize: 14, fontFamily: font.sansSemi }}>
            Save
          </Text>
        </Pressable>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: insets.bottom + 40 }}
      >
        <Text
          style={{
            fontSize: 24,
            fontFamily: font.sansBold,
            color: t.ink,
            letterSpacing: -0.5,
          }}
        >
          How are you today?
        </Text>
        <Text style={{ color: t.ink3, fontSize: 12, fontFamily: font.mono, marginTop: 2 }}>
          {today}
        </Text>

        {/* Mood */}
        <Text
          style={{
            marginTop: space.xl,
            fontSize: 11,
            color: t.ink3,
            letterSpacing: 0.9,
            fontFamily: font.sansSemi,
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          Mood
        </Text>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {MOODS.map((m) => {
            const active = m.value === mood;
            return (
              <Pressable
                key={m.value}
                onPress={() => setMood(m.value)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: radius.md,
                  backgroundColor: active ? t.ink : t.surface,
                  borderWidth: 1,
                  borderColor: active ? t.ink : t.line,
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Text style={{ fontSize: 14, fontFamily: font.sansBold, color: active ? t.bg : t.ink }}>
                  {m.value}
                </Text>
                <Text style={{ fontSize: 10, color: active ? t.bg : t.ink3, fontFamily: font.sansMed }}>
                  {m.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Sliders */}
        <SliderRow label="Energy" value={energy} onChange={setEnergy} />
        <SliderRow label="Sleep quality" value={sleepQuality} onChange={setSleepQuality} />
        <SliderRow label="Libido" value={libido} onChange={setLibido} />
        <SliderRow label="Recovery" value={recovery} onChange={setRecovery} />

        {/* Sleep hours */}
        <View style={{ marginTop: space.md }}>
          <Text
            style={{
              fontSize: 11,
              color: t.ink3,
              letterSpacing: 0.9,
              fontFamily: font.sansSemi,
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            Sleep hours
          </Text>
          <View
            style={{
              backgroundColor: t.surface,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: t.line,
              padding: space.md,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Pressable
              onPress={() => setSleepHours((v) => Math.max(0, Math.round((v - 0.25) * 4) / 4))}
              hitSlop={6}
            >
              <Text style={{ fontSize: 18, color: t.ink, fontFamily: font.sansSemi, paddingHorizontal: 8 }}>
                −
              </Text>
            </Pressable>
            <Text style={{ flex: 1, textAlign: 'center', fontSize: 18, fontFamily: font.monoSemi, color: t.ink }}>
              {sleepHours.toFixed(2)} h
            </Text>
            <Pressable
              onPress={() => setSleepHours((v) => Math.min(24, Math.round((v + 0.25) * 4) / 4))}
              hitSlop={6}
            >
              <Text style={{ fontSize: 18, color: t.ink, fontFamily: font.sansSemi, paddingHorizontal: 8 }}>
                +
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Tags */}
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
          Tags
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {TAGS.map((tag) => {
            const active = tags.includes(tag);
            return (
              <Pressable
                key={tag}
                onPress={() => toggleTag(tag)}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: radius.pill,
                  backgroundColor: active ? t.accent : 'transparent',
                  borderWidth: 1,
                  borderColor: active ? t.accent : t.line,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    color: active ? '#fff' : t.ink2,
                    fontFamily: font.sansMed,
                  }}
                >
                  {tag}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Body */}
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
          Notes
        </Text>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="What did today feel like?"
          placeholderTextColor={t.ink4}
          multiline
          style={{
            backgroundColor: t.surface,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: t.line,
            padding: space.md,
            color: t.ink,
            fontSize: 14,
            minHeight: 120,
            textAlignVertical: 'top',
          }}
        />
      </ScrollView>
    </View>
  );
}

function SliderRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const { t } = useTheme();
  return (
    <View style={{ marginTop: space.md }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
        }}
      >
        <Text
          style={{
            fontSize: 11,
            color: t.ink3,
            letterSpacing: 0.9,
            fontFamily: font.sansSemi,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </Text>
        <Text style={{ fontSize: 14, color: t.ink, fontFamily: font.monoSemi }}>
          {value} / 10
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 3 }}>
        {Array.from({ length: 11 }).map((_, i) => {
          const active = i <= value;
          return (
            <Pressable
              key={i}
              onPress={() => onChange(i)}
              style={{
                flex: 1,
                height: 28,
                borderRadius: 4,
                backgroundColor: active ? t.accent : t.surfaceAlt,
                opacity: active ? 0.5 + i / 20 : 1,
              }}
              hitSlop={4}
            />
          );
        })}
      </View>
    </View>
  );
}
