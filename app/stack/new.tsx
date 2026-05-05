// New stack — editorial rebuild.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EditorialHeadline } from '../../components/editorial/EditorialHeadline';
import { EyebrowLabel } from '../../components/editorial/EyebrowLabel';
import { HairlineRow } from '../../components/editorial/HairlineRow';
import { useEditorialTheme } from '../../lib/design/theme';
import { createStack, type StackItem } from '../../lib/db';
import { PEPTIDES, findPeptide } from '../../lib/peptides';

const GOALS = ['Healing', 'Growth', 'Fat-loss', 'Cognitive', 'Longevity'];

export default function NewStack() {
  const ed = useEditorialTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [goal, setGoal] = useState<string>('Healing');
  const [items, setItems] = useState<StackItem[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const addPeptide = (pid: string) => {
    const p = findPeptide(pid)!;
    const defaultDose = parseInt(p.dose?.match(/(\d+)/)?.[1] ?? '250', 10);
    setItems((prev) => [
      ...prev,
      { peptide_id: pid, dose_mcg: defaultDose, unit: 'mcg', freq: 'daily', time: 'morning' },
    ]);
    setShowPicker(false);
  };

  const removeItem = (i: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  };

  const synergy = (() => {
    if (items.length < 2) return 0;
    let pts = 0;
    for (const it of items) {
      const p = findPeptide(it.peptide_id);
      if (!p) continue;
      for (const other of items) {
        if (other === it) continue;
        const otherP = findPeptide(other.peptide_id);
        if (!otherP) continue;
        if (
          p.stacks.some((s) =>
            s.toLowerCase().includes(otherP.name.toLowerCase().split(' ')[0])
          )
        ) {
          pts += 20;
        }
      }
    }
    return Math.min(100, pts);
  })();

  const save = async () => {
    if (!name.trim() || items.length === 0 || saving) return;
    setSaving(true);
    try {
      await createStack({
        name: name.trim(),
        goal,
        items,
        synergy_score: synergy,
      });
      router.replace('/(tabs)/stacks');
    } catch {
      setSaving(false);
    }
  };

  const canSave = !saving && !!name.trim() && items.length > 0;

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
            ←
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
          New stack
        </Text>
        <Pressable onPress={save} disabled={!canSave} hitSlop={10}>
          <Text
            style={{
              fontFamily: ed.typography.label.fontFamily,
              fontSize: ed.typography.label.fontSize,
              letterSpacing: ed.typography.label.letterSpacing,
              color: !canSave ? ed.colors.ink3 : ed.colors.brand,
              textTransform: 'uppercase',
            }}
          >
            {saving ? 'Saving' : 'Save'}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 64 }}
        keyboardShouldPersistTaps="handled"
      >
        <EditorialHeadline size="title1">{`A *new* stack.`}</EditorialHeadline>

        <View style={{ marginTop: 32 }}>
          <EyebrowLabel withRule>Name</EyebrowLabel>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="My healing stack"
            placeholderTextColor={ed.colors.ink4}
            selectionColor={ed.colors.brand}
            style={{
              marginTop: 14,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: ed.colors.line,
              fontFamily: ed.fraunces('Fraunces_400Regular'),
              fontSize: 22,
              letterSpacing: -0.4,
              color: ed.colors.ink1,
            }}
          />
        </View>

        <View style={{ marginTop: 28 }}>
          <EyebrowLabel withRule>Goal</EyebrowLabel>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
            {GOALS.map((g) => {
              const active = g === goal;
              return (
                <Pressable
                  key={g}
                  onPress={() => setGoal(g)}
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
                    {g}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {items.length >= 2 ? (
          <View style={{ marginTop: 28 }}>
            <EyebrowLabel withRule>Synergy</EyebrowLabel>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 14 }}>
              <Text
                style={{
                  fontFamily: ed.fraunces('Fraunces_300Light'),
                  fontSize: 56,
                  lineHeight: 56,
                  letterSpacing: -2,
                  color: ed.colors.ink1,
                }}
              >
                {synergy}
              </Text>
              <Text
                style={{
                  marginLeft: 8,
                  fontFamily: ed.typography.dataMd.fontFamily,
                  fontSize: ed.typography.dataMd.fontSize,
                  color: ed.colors.ink3,
                }}
              >
                / 100
              </Text>
            </View>
            <View style={{ height: 1, backgroundColor: ed.colors.line, marginTop: 12 }}>
              <View
                style={{
                  width: `${synergy}%`,
                  height: 1,
                  backgroundColor: synergy > 40 ? ed.colors.brand : ed.colors.stateModerate,
                }}
              />
            </View>
            <Text
              style={{
                marginTop: 8,
                fontFamily: ed.typography.bodySm.fontFamily,
                fontSize: ed.typography.bodySm.fontSize,
                color: ed.colors.ink3,
              }}
            >
              {"Based on stack partnerships listed in each peptide's monograph."}
            </Text>
          </View>
        ) : null}

        <View
          style={{
            marginTop: 32,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <EyebrowLabel withRule>{`Peptides · ${items.length}`}</EyebrowLabel>
          <Pressable onPress={() => setShowPicker((v) => !v)} hitSlop={6}>
            <Text
              style={{
                marginLeft: 12,
                fontFamily: ed.typography.label.fontFamily,
                fontSize: ed.typography.label.fontSize,
                letterSpacing: ed.typography.label.letterSpacing,
                color: ed.colors.brand,
                textTransform: 'uppercase',
              }}
            >
              + Add
            </Text>
          </Pressable>
        </View>

        {showPicker ? (
          <View
            style={{
              marginTop: 8,
              maxHeight: 280,
              borderTopWidth: 1,
              borderBottomWidth: 1,
              borderColor: ed.colors.line,
            }}
          >
            <ScrollView>
              {PEPTIDES.map((p, idx) => (
                <View key={p.id}>
                  <Pressable
                    onPress={() => addPeptide(p.id)}
                    style={{
                      paddingVertical: 14,
                      paddingHorizontal: 4,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <View
                      style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: p.color }}
                    />
                    <Text
                      style={{
                        flex: 1,
                        fontFamily: ed.fraunces('Fraunces_400Regular'),
                        fontSize: 16,
                        color: ed.colors.ink1,
                      }}
                    >
                      {p.name}
                    </Text>
                  </Pressable>
                  {idx < PEPTIDES.length - 1 ? <HairlineRow /> : null}
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={{ marginTop: 4 }}>
          {items.map((it, i) => {
            const p = findPeptide(it.peptide_id);
            return (
              <View key={i}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 16,
                    gap: 14,
                  }}
                >
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: p?.color ?? ed.colors.ink3,
                    }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontFamily: ed.fraunces('Fraunces_400Regular'),
                        fontSize: 17,
                        letterSpacing: -0.2,
                        color: ed.colors.ink1,
                      }}
                    >
                      {p?.name ?? it.peptide_id}
                    </Text>
                    <Text
                      style={{
                        marginTop: 2,
                        fontFamily: ed.typography.dataMd.fontFamily,
                        fontSize: ed.typography.dataMd.fontSize,
                        color: ed.colors.ink3,
                      }}
                    >
                      {it.dose_mcg} mcg · {it.freq}
                    </Text>
                  </View>
                  <Pressable onPress={() => removeItem(i)} hitSlop={6}>
                    <Text
                      style={{
                        fontFamily: ed.typography.label.fontFamily,
                        fontSize: ed.typography.label.fontSize,
                        letterSpacing: ed.typography.label.letterSpacing,
                        color: ed.colors.stateWarn,
                        textTransform: 'uppercase',
                      }}
                    >
                      Remove
                    </Text>
                  </Pressable>
                </View>
                {i < items.length - 1 ? <HairlineRow /> : null}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
