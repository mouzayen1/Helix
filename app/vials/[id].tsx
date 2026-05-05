// Vial detail — editorial rebuild. Hairline-divided sections in place
// of card fills; recon details as DataRow-style pairs; remaining %
// shown as serif numeral + thin progress hairline; dose timeline reads
// as ScheduleItem-like rows.
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
import { EditorialButton } from '../../components/editorial/EditorialButton';
import { EyebrowLabel } from '../../components/editorial/EyebrowLabel';
import { HairlineRow } from '../../components/editorial/HairlineRow';
import { useEditorialTheme } from '../../lib/design/theme';
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
import { haptic } from '../../lib/haptics';
import { findPeptide } from '../../lib/peptides';

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
  const ed = useEditorialTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [vial, setVial] = useState<Vial | null>(null);
  const [doses, setDoses] = useState<Dose[]>([]);
  const [editing, setEditing] = useState(false);

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
          backgroundColor: ed.colors.bg,
          paddingTop: insets.top + 24,
          paddingHorizontal: 24,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text
            style={{ fontFamily: ed.fraunces('Fraunces_300Light'), fontSize: 26, color: ed.colors.ink2 }}
          >
            ←
          </Text>
        </Pressable>
        <Text
          style={{
            marginTop: 32,
            fontFamily: ed.typography.label.fontFamily,
            fontSize: ed.typography.label.fontSize,
            letterSpacing: ed.typography.label.letterSpacing,
            color: ed.colors.ink3,
            textTransform: 'uppercase',
          }}
        >
          Loading
        </Text>
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
    status === 'ACTIVE' ? ed.colors.brand : status === 'EXPIRED' ? ed.colors.stateWarn : ed.colors.ink3;
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
        { text: 'Discard', style: 'destructive', onPress: () => router.back() },
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
            haptic.warn();
            await load();
          },
        },
      ]
    );
  };

  const onRestore = async () => {
    await restoreVial(vial.id);
    haptic.success();
    await load();
  };

  const onDelete = () => {
    Alert.alert('Delete vial?', 'The vial is removed but its dose history is preserved.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteVial(vial.id);
          router.back();
        },
      },
    ]);
  };

  const Pair = ({ k, v }: { k: string; v: string }) => (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        paddingVertical: 10,
        gap: 12,
      }}
    >
      <Text
        style={{
          fontFamily: ed.typography.labelSm.fontFamily,
          fontSize: ed.typography.labelSm.fontSize,
          letterSpacing: ed.typography.labelSm.letterSpacing,
          color: ed.colors.ink3,
          textTransform: 'uppercase',
        }}
      >
        {k}
      </Text>
      <Text
        style={{
          fontFamily: ed.typography.dataMd.fontFamily,
          fontSize: ed.typography.dataMd.fontSize,
          color: ed.colors.ink1,
        }}
      >
        {v}
      </Text>
    </View>
  );

  const Field = ({
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
  }) => (
    <View
      style={{
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: ed.colors.line,
      }}
    >
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
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType ?? 'default'}
        placeholder={placeholder}
        placeholderTextColor={ed.colors.ink4}
        selectionColor={ed.colors.brand}
        style={{
          fontFamily: ed.typography.dataMd.fontFamily,
          fontSize: 15,
          color: ed.colors.ink1,
          padding: 0,
        }}
      />
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: ed.colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingBottom: 12,
          paddingHorizontal: 24,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Pressable onPress={handleBack} hitSlop={10}>
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
        {editing ? (
          <Pressable onPress={onSaveEdits} hitSlop={6}>
            <Text
              style={{
                fontFamily: ed.typography.label.fontFamily,
                fontSize: ed.typography.label.fontSize,
                letterSpacing: ed.typography.label.letterSpacing,
                color: ed.colors.brand,
                textTransform: 'uppercase',
              }}
            >
              Save
            </Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 64 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Peptide title block */}
        <View
          style={{
            paddingHorizontal: 24,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <View
            style={{
              width: 6,
              height: 32,
              backgroundColor: peptide?.color ?? ed.colors.ink3,
            }}
          />
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: ed.typography.eyebrow.fontFamily,
                fontSize: ed.typography.eyebrow.fontSize,
                letterSpacing: ed.typography.eyebrow.letterSpacing,
                color: ed.colors.ink3,
                textTransform: 'uppercase',
              }}
            >
              Vial
            </Text>
            <Text
              style={{
                fontFamily: ed.fraunces('Fraunces_400Regular'),
                fontSize: 28,
                letterSpacing: -0.6,
                color: ed.colors.ink1,
              }}
            >
              {peptide?.name ?? vial.peptide_id}
            </Text>
          </View>
          <Text
            style={{
              fontFamily: ed.typography.label.fontFamily,
              fontSize: ed.typography.label.fontSize,
              letterSpacing: ed.typography.label.letterSpacing,
              color: statusColor,
              textTransform: 'uppercase',
            }}
          >
            {status}
          </Text>
        </View>

        {/* Remaining */}
        <View style={{ marginTop: 28, paddingHorizontal: 24 }}>
          <EyebrowLabel withRule>Remaining</EyebrowLabel>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 14 }}>
            <Text
              style={{
                fontFamily: ed.fraunces('Fraunces_300Light'),
                fontSize: 64,
                lineHeight: 64,
                letterSpacing: -2,
                color: ed.colors.ink1,
              }}
            >
              {vial.remaining_mg.toFixed(2)}
            </Text>
            <Text
              style={{
                marginLeft: 8,
                fontFamily: ed.typography.dataMd.fontFamily,
                fontSize: ed.typography.dataMd.fontSize,
                color: ed.colors.ink3,
              }}
            >
              / {vial.strength_mg} mg
            </Text>
          </View>
          <View style={{ height: 1, backgroundColor: ed.colors.line, marginTop: 12 }}>
            <View
              style={{
                width: `${Math.round(remainPct * 100)}%`,
                height: 1,
                backgroundColor: remainPct < 0.15 ? ed.colors.stateWarn : ed.colors.brand,
              }}
            />
          </View>
          <Text
            style={{
              marginTop: 8,
              fontFamily: ed.typography.labelSm.fontFamily,
              fontSize: ed.typography.labelSm.fontSize,
              letterSpacing: ed.typography.labelSm.letterSpacing,
              color: ed.colors.ink3,
              textTransform: 'uppercase',
            }}
          >
            {vial.total_doses_drawn} doses drawn
          </Text>
        </View>

        {/* Reconstitution */}
        <View style={{ marginTop: 28, paddingHorizontal: 24 }}>
          <EyebrowLabel withRule>Reconstitution</EyebrowLabel>
          {editing ? (
            <View style={{ marginTop: 4 }}>
              <Field
                label="Strength · mg"
                value={strengthText}
                onChangeText={setStrengthText}
                keyboardType="decimal-pad"
              />
              <Field
                label="BAC water · mL"
                value={bacText}
                onChangeText={setBacText}
                keyboardType="decimal-pad"
              />
              <Field
                label="Expires · YYYY-MM-DD"
                value={expiresText}
                onChangeText={setExpiresText}
                placeholder="optional"
              />
              <Field
                label="Cost · USD"
                value={costText}
                onChangeText={setCostText}
                keyboardType="decimal-pad"
                placeholder="optional"
              />
            </View>
          ) : (
            <View style={{ marginTop: 4 }}>
              <Pair k="Strength" v={`${vial.strength_mg} mg`} />
              <HairlineRow />
              <Pair k="BAC water" v={`${vial.bac_water_ml} mL`} />
              <HairlineRow />
              <Pair k="Concentration" v={`${vial.concentration.toFixed(3)} mg/mL`} />
              <HairlineRow />
              <Pair k="Reconstituted" v={fmtDate(vial.reconstituted_at)} />
              <HairlineRow />
              <Pair
                k="First used"
                v={vial.first_used_at ? fmtDate(vial.first_used_at) : '—'}
              />
              <HairlineRow />
              <Pair
                k="Expires"
                v={
                  vial.expires_at
                    ? `${fmtDate(vial.expires_at)}${
                        daysToExp !== null
                          ? ` · ${daysToExp < 0 ? 'expired' : `${daysToExp}d`}`
                          : ''
                      }`
                    : '—'
                }
              />
              <HairlineRow />
              <Pair k="Cost" v={vial.cost_usd != null ? `$${vial.cost_usd.toFixed(2)}` : '—'} />
              {vial.depleted_at ? (
                <>
                  <HairlineRow />
                  <Pair k="Depleted" v={fmtDate(vial.depleted_at)} />
                </>
              ) : null}
            </View>
          )}
        </View>

        {/* Notes */}
        <View style={{ marginTop: 28, paddingHorizontal: 24 }}>
          <EyebrowLabel withRule>Notes</EyebrowLabel>
          {editing ? (
            <TextInput
              value={notesText}
              onChangeText={setNotesText}
              multiline
              placeholder="Batch, supplier, observations…"
              placeholderTextColor={ed.colors.ink4}
              selectionColor={ed.colors.brand}
              style={{
                marginTop: 14,
                paddingVertical: 14,
                borderTopWidth: 1,
                borderBottomWidth: 1,
                borderColor: ed.colors.line,
                fontFamily: ed.fraunces('Fraunces_400Regular'),
                fontSize: 15,
                lineHeight: 22,
                color: ed.colors.ink1,
                minHeight: 80,
                textAlignVertical: 'top',
              }}
            />
          ) : (
            <Text
              style={{
                marginTop: 14,
                fontFamily: vial.notes
                  ? ed.fraunces('Fraunces_400Regular')
                  : ed.fraunces('Fraunces_400Regular_Italic'),
                fontSize: 16,
                lineHeight: 24,
                color: vial.notes ? ed.colors.ink2 : ed.colors.ink3,
              }}
            >
              {vial.notes ?? 'No notes.'}
            </Text>
          )}
        </View>

        {/* Dose timeline */}
        <View style={{ marginTop: 28, paddingHorizontal: 24 }}>
          <EyebrowLabel withRule>{`Dose timeline · ${doses.length}`}</EyebrowLabel>
          {doses.length === 0 ? (
            <Text
              style={{
                marginTop: 14,
                fontFamily: ed.fraunces('Fraunces_400Regular_Italic'),
                fontSize: 16,
                color: ed.colors.ink3,
              }}
            >
              No doses drawn from this vial yet.
            </Text>
          ) : (
            <View style={{ marginTop: 4 }}>
              {doses.map((d, idx) => (
                <View key={d.id}>
                  <View style={{ paddingVertical: 14, gap: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 12 }}>
                      <Text
                        style={{
                          fontFamily: ed.fraunces('Fraunces_400Regular'),
                          fontSize: 22,
                          letterSpacing: -0.4,
                          color: ed.colors.ink1,
                        }}
                      >
                        {d.amount_mcg}
                      </Text>
                      <Text
                        style={{
                          fontFamily: ed.typography.labelSm.fontFamily,
                          fontSize: ed.typography.labelSm.fontSize,
                          letterSpacing: ed.typography.labelSm.letterSpacing,
                          color: ed.colors.ink3,
                          textTransform: 'uppercase',
                        }}
                      >
                        mcg
                      </Text>
                      <Text
                        style={{
                          flex: 1,
                          textAlign: 'right',
                          fontFamily: ed.typography.labelSm.fontFamily,
                          fontSize: ed.typography.labelSm.fontSize,
                          letterSpacing: ed.typography.labelSm.letterSpacing,
                          color: ed.colors.ink3,
                          textTransform: 'uppercase',
                        }}
                      >
                        {d.route}
                        {d.site ? ` · ${d.site}` : ''}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontFamily: ed.typography.dataMd.fontFamily,
                        fontSize: ed.typography.dataMd.fontSize,
                        color: ed.colors.ink3,
                      }}
                    >
                      {fmtDateTime(d.taken_at)}
                    </Text>
                    {d.note ? (
                      <Text
                        style={{
                          fontFamily: ed.typography.bodySm.fontFamily,
                          fontSize: ed.typography.bodySm.fontSize,
                          color: ed.colors.ink2,
                        }}
                      >
                        {d.note}
                      </Text>
                    ) : null}
                  </View>
                  {idx < doses.length - 1 ? <HairlineRow /> : null}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={{ marginTop: 36, paddingHorizontal: 24, gap: 12 }}>
          {editing ? (
            <>
              <EditorialButton fullWidth onPress={onSaveEdits}>
                Save changes
              </EditorialButton>
              <EditorialButton
                variant="secondary"
                fullWidth
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
              >
                Cancel
              </EditorialButton>
            </>
          ) : isActive ? (
            <>
              <EditorialButton
                fullWidth
                onPress={() =>
                  router.push({
                    pathname: '/log-dose',
                    params: { peptideId: vial.peptide_id },
                  } as any)
                }
              >
                Log a dose
              </EditorialButton>
              <EditorialButton variant="secondary" fullWidth onPress={() => setEditing(true)}>
                Edit
              </EditorialButton>
              <EditorialButton variant="secondary" fullWidth onPress={onMarkDepleted}>
                Mark depleted
              </EditorialButton>
              <EditorialButton variant="secondary" fullWidth onPress={onDelete}>
                Delete
              </EditorialButton>
            </>
          ) : (
            <>
              <EditorialButton fullWidth onPress={onRestore}>
                Restore to active
              </EditorialButton>
              <EditorialButton variant="secondary" fullWidth onPress={() => setEditing(true)}>
                Edit
              </EditorialButton>
              <EditorialButton variant="secondary" fullWidth onPress={onDelete}>
                Delete
              </EditorialButton>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
