// Journal entry — editorial rebuild. Same upsertJournal flow. Visual:
// editorial modal header, serif headline, mood as 5 sharp-corner tiles
// with eyebrow labels, sliders rendered as 11 hairline ticks per row,
// sleep-hours stepper, hairline-bordered tags, hairline-framed body.
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DateTimeField } from '../components/DateTimeField';
import { EditorialHeadline } from '../components/editorial/EditorialHeadline';
import { EyebrowLabel } from '../components/editorial/EyebrowLabel';
import { useEditorialTheme } from '../lib/design/theme';
import { getJournal, upsertJournal } from '../lib/db';
import { haptic } from '../lib/haptics';

// Local YYYY-MM-DD — entry_date is stored in the user's local calendar
// day, not UTC, so a 10pm entry stays on the right day in any timezone.
function localDateKey(d: Date): string {
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${dy}`;
}

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
  const ed = useEditorialTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Optional `date` query param lets the cycle-detail "Journal during this
  // cycle" list deep-link directly to a past day's entry.
  const params = useLocalSearchParams<{ date?: string }>();
  const initialDate = params.date ? new Date(`${params.date}T12:00:00`) : new Date();

  const [entryAt, setEntryAt] = useState<Date>(initialDate);
  const entryKey = localDateKey(entryAt);

  const [mood, setMood] = useState<number>(3);
  const [energy, setEnergy] = useState(5);
  const [sleepQuality, setSleepQuality] = useState(5);
  const [libido, setLibido] = useState(5);
  const [recovery, setRecovery] = useState(5);
  const [sleepHours, setSleepHours] = useState(7.5);
  const [tags, setTags] = useState<string[]>([]);
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [existedAtLoad, setExistedAtLoad] = useState(false);
  const lastLoadedKey = useRef<string>('');

  // Loads the entry whose entry_date matches entryKey. Re-runs when the
  // user picks a new date in the DateTimeField. cancellation flag prevents
  // late promises from clobbering newer ones.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const existing = await getJournal(entryKey);
        if (cancelled) return;
        if (existing) {
          setMood(existing.mood ?? 3);
          setEnergy(existing.energy ?? 5);
          setSleepQuality(existing.sleep_quality ?? 5);
          setLibido(existing.libido ?? 5);
          setRecovery(existing.recovery ?? 5);
          setSleepHours(existing.sleep_hours ?? 7.5);
          try {
            setTags(JSON.parse(existing.tags_json));
          } catch {
            setTags([]);
          }
          setBody(existing.body ?? '');
          setExistedAtLoad(true);
        } else {
          // Reset to defaults when the user picks a new date and there's
          // no entry yet. Skip on first load (already at defaults).
          if (lastLoadedKey.current !== '') {
            setMood(3);
            setEnergy(5);
            setSleepQuality(5);
            setLibido(5);
            setRecovery(5);
            setSleepHours(7.5);
            setTags([]);
            setBody('');
          }
          setExistedAtLoad(false);
        }
        lastLoadedKey.current = entryKey;
      })();
      return () => {
        cancelled = true;
      };
    }, [entryKey])
  );

  const toggleTag = (tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]));
  };

  const performSave = async () => {
    setSaving(true);
    try {
      await upsertJournal({
        entry_date: entryKey,
        mood,
        energy,
        sleep_hours: sleepHours,
        sleep_quality: sleepQuality,
        libido,
        recovery,
        tags,
        body: body.trim() || undefined,
      });
      haptic.success();
      router.back();
    } catch {
      setSaving(false);
      haptic.error();
    }
  };

  const save = async () => {
    if (saving) return;
    // Replace prompt only when an entry already exists for this date.
    if (existedAtLoad) {
      Alert.alert(
        'Replace existing entry?',
        `An entry already exists for ${entryAt.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
        })}. Saving will replace it with these values.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Replace', style: 'destructive', onPress: () => void performSave() },
        ]
      );
      return;
    }
    void performSave();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: ed.colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
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
          Journal
        </Text>
        <Pressable onPress={save} disabled={saving} hitSlop={10}>
          <Text
            style={{
              fontFamily: ed.typography.label.fontFamily,
              fontSize: ed.typography.label.fontSize,
              letterSpacing: ed.typography.label.letterSpacing,
              color: saving ? ed.colors.ink3 : ed.colors.brand,
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
          {entryKey}
        </Text>
        <EditorialHeadline size="title1">
          {`How are *you*${existedAtLoad ? '' : ' today'}?`}
        </EditorialHeadline>
        {existedAtLoad ? (
          <Text
            style={{
              marginTop: 8,
              fontFamily: ed.typography.label.fontFamily,
              fontSize: ed.typography.label.fontSize,
              letterSpacing: ed.typography.label.letterSpacing,
              color: ed.colors.brand,
              textTransform: 'uppercase',
            }}
          >
            Editing existing entry
          </Text>
        ) : null}

        {/* Date — back-date for journals you forgot to write yesterday */}
        <View style={{ marginTop: 24 }}>
          <DateTimeField value={entryAt} onChange={setEntryAt} label="Date" mode="date" />
        </View>

        {/* Mood */}
        <View style={{ marginTop: 32 }}>
          <EyebrowLabel withRule>Mood</EyebrowLabel>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 14 }}>
            {MOODS.map((m) => {
              const active = m.value === mood;
              return (
                <Pressable
                  key={m.value}
                  onPress={() => setMood(m.value)}
                  style={{
                    flex: 1,
                    paddingVertical: 14,
                    alignItems: 'center',
                    backgroundColor: active ? ed.colors.ink1 : 'transparent',
                    borderWidth: 1,
                    borderColor: active ? ed.colors.ink1 : ed.colors.lineStrong,
                    gap: 4,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: ed.fraunces(active ? 'Fraunces_400Regular' : 'Fraunces_300Light'),
                      fontSize: 22,
                      color: active ? ed.colors.bg : ed.colors.ink1,
                    }}
                  >
                    {m.value}
                  </Text>
                  <Text
                    style={{
                      fontFamily: ed.typography.labelSm.fontFamily,
                      fontSize: ed.typography.labelSm.fontSize,
                      letterSpacing: ed.typography.labelSm.letterSpacing,
                      color: active ? ed.colors.bg : ed.colors.ink3,
                      textTransform: 'uppercase',
                    }}
                  >
                    {m.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <SliderRow label="Energy" value={energy} onChange={setEnergy} />
        <SliderRow label="Sleep quality" value={sleepQuality} onChange={setSleepQuality} />
        <SliderRow label="Libido" value={libido} onChange={setLibido} />
        <SliderRow label="Recovery" value={recovery} onChange={setRecovery} />

        <View style={{ marginTop: 28 }}>
          <EyebrowLabel withRule>Sleep hours</EyebrowLabel>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 14,
            }}
          >
            <Pressable
              onPress={() => setSleepHours((v) => Math.max(0, Math.round((v - 0.25) * 4) / 4))}
              hitSlop={8}
            >
              <Text
                style={{
                  fontFamily: ed.typography.dataLg.fontFamily,
                  fontSize: 22,
                  color: ed.colors.ink3,
                  paddingHorizontal: 14,
                }}
              >
                −
              </Text>
            </Pressable>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' }}>
              <Text
                style={{
                  fontFamily: ed.fraunces('Fraunces_300Light'),
                  fontSize: 36,
                  letterSpacing: -0.6,
                  color: ed.colors.ink1,
                }}
              >
                {sleepHours.toFixed(2)}
              </Text>
              <Text
                style={{
                  marginLeft: 8,
                  fontFamily: ed.typography.label.fontFamily,
                  fontSize: ed.typography.label.fontSize,
                  letterSpacing: ed.typography.label.letterSpacing,
                  color: ed.colors.ink3,
                  textTransform: 'uppercase',
                }}
              >
                h
              </Text>
            </View>
            <Pressable
              onPress={() => setSleepHours((v) => Math.min(24, Math.round((v + 0.25) * 4) / 4))}
              hitSlop={8}
            >
              <Text
                style={{
                  fontFamily: ed.typography.dataLg.fontFamily,
                  fontSize: 22,
                  color: ed.colors.ink3,
                  paddingHorizontal: 14,
                }}
              >
                +
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={{ marginTop: 28 }}>
          <EyebrowLabel withRule>Tags</EyebrowLabel>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
            {TAGS.map((tag) => {
              const active = tags.includes(tag);
              return (
                <Pressable
                  key={tag}
                  onPress={() => toggleTag(tag)}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    backgroundColor: active ? ed.colors.brand : 'transparent',
                    borderWidth: 1,
                    borderColor: active ? ed.colors.brand : ed.colors.lineStrong,
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
                    {tag}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ marginTop: 28 }}>
          <EyebrowLabel withRule>Notes</EyebrowLabel>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="What did today feel like?"
            placeholderTextColor={ed.colors.ink4}
            multiline
            selectionColor={ed.colors.brand}
            style={{
              marginTop: 14,
              paddingVertical: 14,
              paddingHorizontal: 0,
              borderTopWidth: 1,
              borderBottomWidth: 1,
              borderColor: ed.colors.line,
              fontFamily: ed.fraunces('Fraunces_400Regular'),
              fontSize: 16,
              lineHeight: 24,
              letterSpacing: -0.2,
              color: ed.colors.ink1,
              minHeight: 140,
              textAlignVertical: 'top',
            }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  const ed = useEditorialTheme();
  return (
    <View style={{ marginTop: 28 }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 12,
        }}
      >
        <Text
          style={{
            fontFamily: ed.typography.label.fontFamily,
            fontSize: ed.typography.label.fontSize,
            letterSpacing: ed.typography.label.letterSpacing,
            color: ed.colors.ink3,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Text
            style={{
              fontFamily: ed.fraunces('Fraunces_400Regular'),
              fontSize: 22,
              letterSpacing: -0.3,
              color: ed.colors.ink1,
            }}
          >
            {value}
          </Text>
          <Text
            style={{
              fontFamily: ed.typography.dataMd.fontFamily,
              fontSize: ed.typography.dataMd.fontSize,
              color: ed.colors.ink3,
              marginLeft: 4,
            }}
          >
            /10
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {Array.from({ length: 11 }).map((_, i) => {
          const active = i <= value;
          return (
            <Pressable
              key={i}
              onPress={() => onChange(i)}
              style={{
                flex: 1,
                height: 28,
                backgroundColor: active ? ed.colors.brand : 'transparent',
                borderWidth: 1,
                borderColor: active ? ed.colors.brand : ed.colors.line,
              }}
              hitSlop={4}
            />
          );
        })}
      </View>
    </View>
  );
}
