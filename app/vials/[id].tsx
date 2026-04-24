// Vial detail — view/edit a single vial, dose timeline, lifecycle actions.
// v1.1 Phase 3.
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconChevronLeft } from '../../components/Icons';
import {
  deactivateVial,
  deleteVial,
  getDosesForVial,
  getVial,
  restoreVial,
  updateVial,
  type Dose,
  type Vial,
} from '../../lib/db';
import { findPeptide } from '../../lib/peptides';
import { useTheme } from '../../theme/ThemeContext';
import { font, radius, space } from '../../theme/tokens';

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function VialDetailScreen() {
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [vial, setVial] = useState<Vial | null>(null);
  const [doses, setDoses] = useState<Dose[]>([]);
  const [editing, setEditing] = useState(false);

  // Editable draft state
  const [strengthText, setStrengthText] = useState('');
  const [bacText, setBacText] = useState('');
  const [costText, setCostText] = useState('');
  const [expiresText, setExpiresText] = useState('');
  const [notesText, setNotesText] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    const [v, ds] = await Promise.all([getVial(id), getDosesForVial(id)]);
    setVial(v);
    setDoses(ds);
    if (v) {
      setStrengthText(String(v.strength_mg));
      setBacText(String(v.bac_water_ml));
      setCostText(v.cost_usd != null ? String(v.cost_usd) : '');
      setExpiresText(v.expires_at ? v.expires_at.slice(0, 10) : '');
      setNotesText(v.notes ?? '');
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!vial) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: t.bg,
          paddingTop: insets.top + space.md,
          paddingHorizontal: space.xl,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <IconChevronLeft size={18} color={t.ink} />
        </Pressable>
        <Text style={{ marginTop: space.md, color: t.ink3 }}>Loading vial…</Text>
      </View>
    );
  }

  const peptide = findPeptide(vial.peptide_id);
  const isActive = vial.is_active === 1;
  const daysToExp = vial.expires_at
    ? Math.ceil((new Date(vial.expires_at).getTime() - Date.now()) / 864e5)
    : null;
  const expired = daysToExp !== null && daysToExp < 0;
  const status: 'ACTIVE' | 'DEPLETED' | 'EXPIRED' = !isActive
    ? 'DEPLETED'
    : expired
    ? 'EXPIRED'
    : 'ACTIVE';
  const statusColor =
    status === 'ACTIVE' ? t.accent : status === 'EXPIRED' ? t.danger : t.ink3;
  const remainPct = Math.max(
    0,
    Math.min(1, vial.remaining_mg / Math.max(0.0001, vial.strength_mg))
  );

  const isDirty =
    Number(strengthText) !== vial.strength_mg ||
    Number(bacText) !== vial.bac_water_ml ||
    (costText === '' ? vial.cost_usd != null : Number(costText) !== (vial.cost_usd ?? NaN)) ||
    (expiresText || '') !== (vial.expires_at?.slice(0, 10) ?? '') ||
    (notesText || '') !== (vial.notes ?? '');

  const handleBack = () => {
    if (editing && isDirty) {
      Alert.alert('Discard changes?', 'Your edits will not be saved.', [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => router.back(),
        },
      ]);
      return;
    }
    router.back();
  };

  const onSaveEdits = async () => {
    const strength = parseFloat(strengthText);
    const bac = parseFloat(bacText);
    if (isNaN(strength) || strength <= 0 || isNaN(bac) || bac <= 0) {
      Alert.alert('Invalid values', 'Strength and BAC water must be positive numbers.');
      return;
    }
    const cost = costText.trim() === '' ? null : parseFloat(costText);
    if (cost !== null && (isNaN(cost) || cost < 0)) {
      Alert.alert('Invalid cost', 'Leave blank or enter a non-negative number.');
      return;
    }
    const expiresIso = expiresText.trim() === ''
      ? null
      : new Date(expiresText + 'T00:00:00').toISOString();

    const changingStrength = strength !== vial.strength_mg;
    const drawnMg = doses.reduce((s, d) => s + d.amount_mcg / 1000, 0);
    if (changingStrength && strength < drawnMg) {
      Alert.alert(
        'Strength too low',
        `This vial has ${drawnMg.toFixed(3)} mg already drawn. Strength must be at least that.`
      );
      return;
    }

    const proceed = async () => {
      await updateVial(vial.id, {
        strength_mg: strength,
        bac_water_ml: bac,
        expires_at: expiresIso,
        notes: notesText.trim() || null,
        cost_usd: cost,
      });
      setEditing(false);
      await load();
    };

    if (changingStrength) {
      Alert.alert(
        'Changing strength',
        'Remaining and concentration will be recomputed from the dose history. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save', onPress: () => void proceed() },
        ]
      );
    } else {
      await proceed();
    }
  };

  const onMarkDepleted = () => {
    Alert.alert(
      'Mark depleted?',
      'This vial will move to History. You can restore it later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark depleted',
          style: 'destructive',
          onPress: async () => {
            await deactivateVial(vial.id);
            await load();
          },
        },
      ]
    );
  };

  const onRestore = async () => {
    await restoreVial(vial.id);
    await load();
  };

  const onDelete = () => {
    Alert.alert(
      'Delete vial?',
      'The vial is removed but its dose history is preserved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteVial(vial.id);
            router.back();
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
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
        <Pressable onPress={handleBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <IconChevronLeft size={18} color={t.ink} />
        </Pressable>
        <Text style={{ flex: 1, fontSize: 18, fontFamily: font.sansBold, color: t.ink }}>
          Vial
        </Text>
        {editing ? (
          <Pressable onPress={onSaveEdits} hitSlop={6}>
            <Text style={{ color: t.accent, fontSize: 14, fontFamily: font.sansSemi }}>Save</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + space['2xl'] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Peptide header */}
        <View
          style={{
            paddingHorizontal: space.xl,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <View
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: peptide?.color ?? t.ink3,
            }}
          />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontFamily: font.sansBold, color: t.ink }}>
              {peptide?.name ?? vial.peptide_id}
            </Text>
            <Text style={{ fontSize: 11, color: t.ink3, fontFamily: font.mono, marginTop: 2 }}>
              {peptide?.class ?? '—'}
            </Text>
          </View>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 8,
              backgroundColor: status === 'ACTIVE' ? t.accentSoft : t.surfaceAlt,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontFamily: font.sansSemi,
                color: statusColor,
                letterSpacing: 0.8,
              }}
            >
              {status}
            </Text>
          </View>
        </View>

        {/* Reconstitution card */}
        <View
          style={{
            marginHorizontal: space.xl,
            marginTop: space.lg,
            backgroundColor: t.surface,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: t.line,
            padding: space.md,
            gap: 10,
          }}
        >
          <SectionLabel label="Reconstitution" />
          {editing ? (
            <View style={{ gap: 10 }}>
              <FieldRow
                label="Strength (mg)"
                value={strengthText}
                onChangeText={setStrengthText}
                keyboardType="decimal-pad"
              />
              <FieldRow
                label="BAC water (mL)"
                value={bacText}
                onChangeText={setBacText}
                keyboardType="decimal-pad"
              />
              <FieldRow
                label="Expires (YYYY-MM-DD)"
                value={expiresText}
                onChangeText={setExpiresText}
                placeholder="optional"
              />
              <FieldRow
                label="Cost (USD)"
                value={costText}
                onChangeText={setCostText}
                keyboardType="decimal-pad"
                placeholder="optional"
              />
            </View>
          ) : (
            <View style={{ gap: 6 }}>
              <Pair k="Strength" v={`${vial.strength_mg} mg`} />
              <Pair k="BAC water" v={`${vial.bac_water_ml} mL`} />
              <Pair k="Concentration" v={`${vial.concentration.toFixed(3)} mg/mL`} />
              <Pair k="Reconstituted" v={fmtDate(vial.reconstituted_at)} />
              <Pair k="First used" v={vial.first_used_at ? fmtDate(vial.first_used_at) : '—'} />
              <Pair
                k="Expires"
                v={
                  vial.expires_at
                    ? `${fmtDate(vial.expires_at)}${
                        daysToExp !== null ? ` · ${daysToExp < 0 ? 'expired' : `${daysToExp}d`}` : ''
                      }`
                    : '—'
                }
              />
              <Pair k="Cost" v={vial.cost_usd != null ? `$${vial.cost_usd.toFixed(2)}` : '—'} />
              {vial.depleted_at ? (
                <Pair k="Depleted" v={fmtDate(vial.depleted_at)} />
              ) : null}
            </View>
          )}
        </View>

        {/* Remaining card */}
        <View
          style={{
            marginHorizontal: space.xl,
            marginTop: space.md,
            backgroundColor: t.surface,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: t.line,
            padding: space.md,
            gap: 10,
          }}
        >
          <SectionLabel label="Remaining" />
          <Text style={{ fontSize: 22, fontFamily: font.monoSemi, color: t.ink }}>
            {vial.remaining_mg.toFixed(2)} / {vial.strength_mg} mg
          </Text>
          <View
            style={{
              height: 8,
              backgroundColor: t.surfaceAlt,
              borderRadius: 4,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${Math.round(remainPct * 100)}%`,
                height: 8,
                backgroundColor: remainPct < 0.15 ? t.warn : t.accent,
              }}
            />
          </View>
          <Text style={{ fontSize: 11, color: t.ink3, fontFamily: font.mono }}>
            {vial.total_doses_drawn} doses drawn
          </Text>
        </View>

        {/* Notes */}
        <View
          style={{
            marginHorizontal: space.xl,
            marginTop: space.md,
            backgroundColor: t.surface,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: t.line,
            padding: space.md,
            gap: 8,
          }}
        >
          <SectionLabel label="Notes" />
          {editing ? (
            <TextInput
              value={notesText}
              onChangeText={setNotesText}
              multiline
              placeholder="Batch, supplier, observations…"
              placeholderTextColor={t.ink4}
              style={{
                color: t.ink,
                fontSize: 14,
                minHeight: 60,
                padding: 0,
                textAlignVertical: 'top',
              }}
            />
          ) : (
            <Text style={{ color: vial.notes ? t.ink2 : t.ink4, fontSize: 13, lineHeight: 19 }}>
              {vial.notes ?? 'No notes'}
            </Text>
          )}
        </View>

        {/* Dose timeline */}
        <View
          style={{
            marginHorizontal: space.xl,
            marginTop: space.md,
            backgroundColor: t.surface,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: t.line,
            padding: space.md,
            gap: 10,
          }}
        >
          <SectionLabel label={`Dose timeline · ${doses.length}`} />
          {doses.length === 0 ? (
            <Text style={{ color: t.ink3, fontSize: 13 }}>No doses drawn from this vial yet.</Text>
          ) : (
            doses.map((d) => (
              <View key={d.id} style={{ gap: 2, paddingVertical: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontFamily: font.monoSemi,
                      color: t.ink,
                    }}
                  >
                    {d.amount_mcg} mcg
                  </Text>
                  <Text style={{ fontSize: 11, color: t.ink3, fontFamily: font.mono }}>
                    {d.route}
                    {d.site ? ` · ${d.site}` : ''}
                  </Text>
                </View>
                <Text style={{ fontSize: 11, color: t.ink3, fontFamily: font.mono }}>
                  {fmtDateTime(d.taken_at)}
                </Text>
                {d.note ? (
                  <Text style={{ fontSize: 12, color: t.ink3, marginTop: 2 }}>{d.note}</Text>
                ) : null}
              </View>
            ))
          )}
        </View>

        {/* Bottom actions */}
        <View style={{ marginHorizontal: space.xl, marginTop: space.lg, gap: 8 }}>
          {editing ? (
            <>
              <PrimaryButton label="Save changes" onPress={onSaveEdits} />
              <SecondaryButton
                label="Cancel"
                onPress={() => {
                  if (isDirty) {
                    Alert.alert('Discard changes?', 'Your edits will not be saved.', [
                      { text: 'Keep editing', style: 'cancel' },
                      {
                        text: 'Discard',
                        style: 'destructive',
                        onPress: () => {
                          setEditing(false);
                          void load();
                        },
                      },
                    ]);
                  } else {
                    setEditing(false);
                  }
                }}
              />
            </>
          ) : isActive ? (
            <>
              <PrimaryButton
                label="Log a dose"
                onPress={() =>
                  router.push({
                    pathname: '/log-dose',
                    params: { peptideId: vial.peptide_id },
                  } as any)
                }
              />
              <SecondaryButton label="Edit" onPress={() => setEditing(true)} />
              <SecondaryButton label="Mark depleted" onPress={onMarkDepleted} tone="warn" />
              <SecondaryButton label="Delete" onPress={onDelete} tone="danger" />
            </>
          ) : (
            <>
              <PrimaryButton label="Restore to active" onPress={onRestore} />
              <SecondaryButton label="Edit" onPress={() => setEditing(true)} />
              <SecondaryButton label="Delete" onPress={onDelete} tone="danger" />
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SectionLabel({ label }: { label: string }) {
  const { t } = useTheme();
  return (
    <Text
      style={{
        fontSize: 10,
        letterSpacing: 0.8,
        color: t.ink3,
        fontFamily: font.sansSemi,
        textTransform: 'uppercase',
      }}
    >
      {label}
    </Text>
  );
}

function Pair({ k, v }: { k: string; v: string }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: 13, color: t.ink3 }}>{k}</Text>
      <Text style={{ fontSize: 13, color: t.ink, fontFamily: font.mono }}>{v}</Text>
    </View>
  );
}

function FieldRow({
  label,
  value,
  onChangeText,
  keyboardType,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'decimal-pad' | 'default';
  placeholder?: string;
}) {
  const { t } = useTheme();
  return (
    <View>
      <Text
        style={{
          fontSize: 10,
          letterSpacing: 0.5,
          color: t.ink3,
          fontFamily: font.sansSemi,
          textTransform: 'uppercase',
          marginBottom: 4,
        }}
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType ?? 'default'}
        placeholder={placeholder}
        placeholderTextColor={t.ink4}
        style={{
          borderWidth: 1,
          borderColor: t.line,
          borderRadius: radius.sm,
          paddingHorizontal: 10,
          paddingVertical: 8,
          fontSize: 14,
          color: t.ink,
          fontFamily: font.mono,
          backgroundColor: t.bg,
        }}
      />
    </View>
  );
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { t } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        padding: space.md,
        borderRadius: radius.md,
        backgroundColor: t.ink,
        alignItems: 'center',
      }}
    >
      <Text style={{ color: t.bg, fontSize: 14, fontFamily: font.sansSemi }}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({
  label,
  onPress,
  tone,
}: {
  label: string;
  onPress: () => void;
  tone?: 'warn' | 'danger';
}) {
  const { t } = useTheme();
  const color = tone === 'danger' ? t.danger : tone === 'warn' ? t.warn : t.ink2;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        padding: space.md,
        borderRadius: radius.md,
        backgroundColor: t.surface,
        borderWidth: 1,
        borderColor: t.line,
        alignItems: 'center',
      }}
    >
      <Text style={{ color, fontSize: 14, fontFamily: font.sansSemi }}>{label}</Text>
    </Pressable>
  );
}
