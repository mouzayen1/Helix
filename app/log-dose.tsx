// Log dose — editorial rebuild. Same data flow (logDose, vial picking,
// duplicate guard, prefill from cycle, back-dating to 30 days). Visual
// is the editorial modal pattern throughout: hairline-divided sections,
// large serif dose input, sharp-corner chips, mono uppercase labels,
// EditorialButton primary save.
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DateTimeField } from '../components/DateTimeField';
import { EditorialButton } from '../components/editorial/EditorialButton';
import { EditorialHeadline } from '../components/editorial/EditorialHeadline';
import { EyebrowLabel } from '../components/editorial/EyebrowLabel';
import { HairlineRow } from '../components/editorial/HairlineRow';
import { DosingDisclaimer } from '../components/Primitives';
import { useEditorialTheme } from '../lib/design/theme';
import { DoseInputUnitChip } from '../components/editorial/DoseUnitChip';
import {
  formatDose,
  parseDoseInput,
  resolveDoseUnit,
  type DoseUnit,
} from '../lib/dose-format';
import {
  attachVialToCycle,
  getActiveCycle,
  getActiveCycleForPeptide,
  getVialsForPeptide,
  INJECTION_SITES,
  listActiveVials,
  listDoses,
  logDose,
  siteSuggestion,
  type Cycle,
  type Vial,
} from '../lib/db';
import { haptic } from '../lib/haptics';
import { findPeptide, PEPTIDES } from '../lib/peptides';

const ROUTES = ['SubQ', 'IM', 'Oral', 'Topical', 'Intranasal'] as const;
type Route = (typeof ROUTES)[number];

function parseDoseRange(dose: string): { lo: number; mid: number; hi: number } {
  const nums = [...dose.matchAll(/(\d+(?:\.\d+)?)/g)].map((m) => parseFloat(m[1]));
  if (nums.length === 0) return { lo: 100, mid: 250, hi: 500 };
  const isMg = /\bmg\b/i.test(dose);
  const factor = isMg ? 1000 : 1;
  const vals = nums.map((n) => n * factor);
  if (vals.length === 1) {
    return { lo: Math.round(vals[0] * 0.5), mid: vals[0], hi: Math.round(vals[0] * 1.5) };
  }
  const lo = vals[0];
  const hi = vals[vals.length - 1];
  const mid = Math.round((lo + hi) / 2);
  return { lo: Math.round(lo), mid, hi: Math.round(hi) };
}

export default function LogDoseModal() {
  const ed = useEditorialTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { peptideId: initialId, prefillDoseMcg, site: initialSite } = useLocalSearchParams<{
    peptideId?: string;
    prefillDoseMcg?: string;
    site?: string;
  }>();

  const [showPeptidePicker, setShowPeptidePicker] = useState(false);
  const [peptideId, setPeptideId] = useState<string>(initialId || '');
  const [amountMcg, setAmountMcg] = useState(100);
  const [amountText, setAmountText] = useState('100');
  // Local input mode for the dose field. Defaults to mg when current
  // mcg ≥ 1000, else mcg. Independent from the global dose_unit_pref.
  const [doseInputMode, setDoseInputModeState] = useState<DoseUnit>('mcg');
  const [route, setRoute] = useState<Route>('SubQ');
  const [site, setSite] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [vial, setVial] = useState<Vial | null>(null);
  const [vials, setVials] = useState<Vial[]>([]);
  const [peptideVials, setPeptideVials] = useState<Vial[]>([]);
  const [activeCycle, setActiveCycle] = useState<Cycle | null>(null);
  const [saving, setSaving] = useState(false);
  const [takenAtDate, setTakenAtDate] = useState<Date>(new Date());

  const peptide = peptideId ? findPeptide(peptideId) : null;

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [vs, sug, c] = await Promise.all([
          listActiveVials(),
          siteSuggestion(),
          getActiveCycle(),
        ]);
        setVials(vs);
        setActiveCycle(c);
        if (!peptideId) {
          if (vs.length) {
            setPeptideId(vs[0].peptide_id);
            setVial(vs[0]);
          } else if (PEPTIDES.length) {
            setPeptideId(PEPTIDES[0].id);
          }
        }
        if (!site) setSite(initialSite ?? sug.site);
      })();
    }, [initialSite, peptideId, site])
  );

  useEffect(() => {
    if (!peptideId) return;
    (async () => {
      const active = await getVialsForPeptide(peptideId, true);
      setPeptideVials(active);
      if (active.length === 0) {
        setVial(null);
        return;
      }
      const keep = vial && active.find((v) => v.id === vial.id);
      if (keep) return;
      const sorted = [...active].sort((a, b) => {
        if (!a.expires_at && !b.expires_at) return 0;
        if (!a.expires_at) return 1;
        if (!b.expires_at) return -1;
        return a.expires_at.localeCompare(b.expires_at);
      });
      setVial(sorted[0] ?? null);
    })();
  }, [peptideId, vial]);

  useEffect(() => {
    if (!peptideId) return;
    const apply = (mcg: number) => {
      const mode = resolveDoseUnit(mcg, 'auto');
      setAmountMcg(mcg);
      setDoseInputModeState(mode);
      setAmountText(formatDose(mcg, mode).value);
    };
    if (prefillDoseMcg) {
      const n = parseFloat(prefillDoseMcg);
      if (!isNaN(n) && n > 0) {
        apply(n);
        return;
      }
    }
    if (activeCycle) {
      try {
        const protocol = JSON.parse(activeCycle.protocol_json || '[]') as {
          peptide_id: string;
          dose_mcg: number;
        }[];
        const match = protocol.find((row) => row.peptide_id === peptideId);
        if (match) {
          apply(match.dose_mcg);
          return;
        }
      } catch {}
    }
    const p = findPeptide(peptideId);
    if (p) {
      const fallback = p.defaultDoseMcg ?? parseDoseRange(p.dose).mid;
      apply(fallback);
    }
  }, [peptideId, activeCycle, prefillDoseMcg]);

  const volumeUnits = useMemo(() => {
    if (!vial) return null;
    const volume_ml = amountMcg / (vial.concentration * 1000);
    const units = volume_ml * 100;
    return { units, volume_ml };
  }, [vial, amountMcg]);

  const vialInsufficient = !!vial && amountMcg / 1000 > vial.remaining_mg;

  const presets = useMemo(() => {
    if (!peptide) return [100, 250, 500];
    const range = parseDoseRange(peptide.dose);
    const mid = peptide.defaultDoseMcg ?? range.mid;
    const lo = range.lo === mid ? Math.max(1, Math.round(mid * 0.5)) : range.lo;
    const hi = range.hi === mid ? Math.round(mid * 1.5) : range.hi;
    return [lo, mid, hi];
  }, [peptide]);

  const commitDose = () => {
    const parsed = parseDoseInput(amountText, doseInputMode);
    if (parsed === null || parsed <= 0 || parsed > 500000) {
      setAmountText(formatDose(amountMcg, doseInputMode).value);
    } else {
      setAmountMcg(parsed);
      setAmountText(formatDose(parsed, doseInputMode).value);
    }
  };

  const onDoseInputModeChange = (next: DoseUnit) => {
    setDoseInputModeState(next);
    setAmountText(formatDose(amountMcg, next).value);
  };

  const actuallySave = async () => {
    setSaving(true);
    try {
      await logDose({
        peptide_id: peptideId,
        vial_id: vial?.id ?? null,
        amount_mcg: amountMcg,
        volume_units: volumeUnits?.units,
        route,
        site,
        taken_at: takenAtDate.toISOString(),
        note: note.trim() || undefined,
      });
      haptic.success();
      // v1.2: if the dose's vial isn't attached to any cycle but an
      // active cycle covers this peptide, offer to attach. We never
      // auto-attach silently.
      if (vial && !vial.cycle_id) {
        const cov = await getActiveCycleForPeptide(peptideId);
        if (cov) {
          Alert.alert(
            'Attach this vial to your cycle?',
            `This ${peptide?.name ?? 'vial'} isn't linked to a cycle yet. Attach it to "${cov.name}" so future doses associate automatically?`,
            [
              { text: 'Not now', style: 'cancel', onPress: () => router.back() },
              {
                text: 'Attach',
                onPress: async () => {
                  try {
                    await attachVialToCycle(vial.id, cov.id);
                  } catch {
                    /* non-fatal */
                  }
                  router.back();
                },
              },
            ]
          );
          return;
        }
      }
      router.back();
    } catch (err) {
      setSaving(false);
      haptic.error();
      const msg = err instanceof Error && err.message ? err.message : 'Please try again.';
      Alert.alert('Could not log dose', msg, [{ text: 'OK' }]);
    }
  };

  const save = async () => {
    if (!peptideId || saving) return;
    try {
      const recent = await listDoses({ limit: 20 });
      const target = takenAtDate.getTime();
      const match = recent.find(
        (d) =>
          d.peptide_id === peptideId &&
          Math.abs(new Date(d.taken_at).getTime() - target) < 10 * 60 * 1000
      );
      if (match) {
        const mins = Math.max(
          1,
          Math.round((Date.now() - new Date(match.taken_at).getTime()) / 60000)
        );
        Alert.alert(
          'Already logged recently?',
          `You logged ${peptide?.name ?? 'this peptide'} ${mins} min ago. Log again?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Log anyway', onPress: () => void actuallySave() },
          ]
        );
        return;
      }
    } catch {}
    await actuallySave();
  };

  const vialPeptideIds = useMemo(() => new Set(vials.map((v) => v.peptide_id)), [vials]);
  const peptidesWithoutVial = useMemo(
    () => PEPTIDES.filter((p) => !vialPeptideIds.has(p.id)),
    [vialPeptideIds]
  );

  return (
    <View style={{ flex: 1, backgroundColor: ed.colors.bg }}>
      {/* Header */}
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
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Close">
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
          Log dose
        </Text>
        <Pressable
          onPress={save}
          disabled={saving || vialInsufficient || !peptideId}
          hitSlop={10}
          accessibilityLabel="Save dose"
        >
          <Text
            style={{
              fontFamily: ed.typography.label.fontFamily,
              fontSize: ed.typography.label.fontSize,
              letterSpacing: ed.typography.label.letterSpacing,
              color:
                saving || vialInsufficient || !peptideId
                  ? ed.colors.ink3
                  : ed.colors.brand,
              textTransform: 'uppercase',
            }}
          >
            {saving ? 'Saving' : 'Save'}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 64 }}
      >
        {/* Peptide selector */}
        <View style={{ paddingHorizontal: 24 }}>
          <EyebrowLabel withRule>Peptide</EyebrowLabel>
          <Pressable
            onPress={() => setShowPeptidePicker((v) => !v)}
            accessibilityRole="button"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 18,
              gap: 12,
            }}
          >
            <View style={{ flex: 1 }}>
              {peptide ? (
                <>
                  <Text
                    style={{
                      fontFamily: ed.fraunces('Fraunces_400Regular'),
                      fontSize: 24,
                      letterSpacing: -0.4,
                      color: ed.colors.ink1,
                    }}
                  >
                    {peptide.name}
                  </Text>
                  <Text
                    style={{
                      marginTop: 2,
                      fontFamily: ed.typography.dataMd.fontFamily,
                      fontSize: ed.typography.dataMd.fontSize,
                      color: ed.colors.ink3,
                    }}
                  >
                    {peptide.formula}
                  </Text>
                </>
              ) : (
                <Text
                  style={{
                    fontFamily: ed.fraunces('Fraunces_400Regular_Italic'),
                    fontSize: 22,
                    color: ed.colors.ink3,
                  }}
                >
                  Select peptide
                </Text>
              )}
            </View>
            <Text
              style={{
                fontFamily: ed.fraunces('Fraunces_300Light'),
                fontSize: 22,
                color: ed.colors.ink3,
              }}
            >
              {showPeptidePicker ? '▴' : '▾'}
            </Text>
          </Pressable>
          <HairlineRow strong />
        </View>

        {showPeptidePicker ? (
          <View
            style={{
              marginHorizontal: 24,
              marginTop: 4,
              height: 360,
              borderBottomWidth: 1,
              borderColor: ed.colors.line,
            }}
          >
            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
              {vials.length > 0 ? (
                <View>
                  <View style={{ paddingTop: 14, paddingBottom: 6 }}>
                    <Text
                      style={{
                        fontFamily: ed.typography.eyebrow.fontFamily,
                        fontSize: ed.typography.eyebrow.fontSize,
                        letterSpacing: ed.typography.eyebrow.letterSpacing,
                        color: ed.colors.ink3,
                        textTransform: 'uppercase',
                      }}
                    >
                      Your vials
                    </Text>
                  </View>
                  {vials.map((v, idx) => {
                    const p = findPeptide(v.peptide_id);
                    if (!p) return null;
                    return (
                      <View key={v.id}>
                        <Pressable
                          onPress={() => {
                            setPeptideId(p.id);
                            setVial(v);
                            setShowPeptidePicker(false);
                          }}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingVertical: 14,
                            gap: 12,
                          }}
                        >
                          <View
                            style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: p.color }}
                          />
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                fontFamily: ed.fraunces('Fraunces_400Regular'),
                                fontSize: 17,
                                color: ed.colors.ink1,
                              }}
                            >
                              {p.name}
                            </Text>
                            <Text
                              style={{
                                marginTop: 3,
                                fontFamily: ed.typography.dataMd.fontFamily,
                                fontSize: ed.typography.dataMd.fontSize,
                                color: ed.colors.ink3,
                              }}
                            >
                              {v.remaining_mg.toFixed(2)} / {v.strength_mg} mg
                            </Text>
                          </View>
                          <Text
                            style={{
                              fontFamily: ed.typography.labelSm.fontFamily,
                              fontSize: ed.typography.labelSm.fontSize,
                              letterSpacing: ed.typography.labelSm.letterSpacing,
                              color: ed.colors.brand,
                              textTransform: 'uppercase',
                            }}
                          >
                            Vial
                          </Text>
                        </Pressable>
                        {idx < vials.length - 1 ? <HairlineRow /> : null}
                      </View>
                    );
                  })}
                </View>
              ) : null}

              <View style={{ paddingTop: 18, paddingBottom: 6 }}>
                <Text
                  style={{
                    fontFamily: ed.typography.eyebrow.fontFamily,
                    fontSize: ed.typography.eyebrow.fontSize,
                    letterSpacing: ed.typography.eyebrow.letterSpacing,
                    color: ed.colors.ink3,
                    textTransform: 'uppercase',
                  }}
                >
                  {vials.length > 0 ? 'Other · tap to reconstitute' : 'All peptides'}
                </Text>
              </View>
              {peptidesWithoutVial.map((p, idx) => (
                <View key={p.id}>
                  <Pressable
                    onPress={() => {
                      setShowPeptidePicker(false);
                      router.replace({
                        pathname: '/reconstitute',
                        params: { peptideId: p.id },
                      } as any);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 14,
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
                        color: ed.colors.ink2,
                      }}
                    >
                      {p.name}
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
                      {p.class.split('/')[0].trim()}
                    </Text>
                  </Pressable>
                  {idx < peptidesWithoutVial.length - 1 ? <HairlineRow /> : null}
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Dose */}
        <View style={{ marginTop: 28, paddingHorizontal: 24 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <EyebrowLabel withRule>Dose</EyebrowLabel>
            <DoseInputUnitChip mode={doseInputMode} onChange={onDoseInputModeChange} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', paddingVertical: 16 }}>
            <TextInput
              value={amountText}
              onChangeText={setAmountText}
              onBlur={commitDose}
              onSubmitEditing={commitDose}
              keyboardType="decimal-pad"
              returnKeyType="done"
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
              {doseInputMode}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {presets.map((preset) => {
              const active = preset === amountMcg;
              const presetFmt = formatDose(preset, doseInputMode);
              return (
                <Pressable
                  key={preset}
                  onPress={() => {
                    setAmountMcg(preset);
                    setAmountText(presetFmt.value);
                  }}
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
                    {presetFmt.value} {presetFmt.unit}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {peptide?.dose ? (
            <Text
              style={{
                marginTop: 10,
                fontFamily: ed.typography.dataMd.fontFamily,
                fontSize: ed.typography.dataMd.fontSize,
                color: ed.colors.ink3,
              }}
            >
              Research range: {peptide.dose}
            </Text>
          ) : null}

          {volumeUnits ? (
            <Text
              style={{
                marginTop: 6,
                fontFamily: ed.typography.dataMd.fontFamily,
                fontSize: ed.typography.dataMd.fontSize,
                color: ed.colors.ink3,
              }}
            >
              ≈ {volumeUnits.units.toFixed(1)} units · {volumeUnits.volume_ml.toFixed(2)} mL
            </Text>
          ) : null}

          {vial ? (
            <View
              style={{
                marginTop: 14,
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderWidth: 1,
                borderColor: vialInsufficient ? ed.colors.stateWarn : ed.colors.lineStrong,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontFamily: ed.typography.labelSm.fontFamily,
                  fontSize: ed.typography.labelSm.fontSize,
                  letterSpacing: ed.typography.labelSm.letterSpacing,
                  color: vialInsufficient ? ed.colors.stateWarn : ed.colors.ink3,
                  textTransform: 'uppercase',
                }}
              >
                {vialInsufficient ? 'Not enough in vial' : 'Vial remaining'}
              </Text>
              <Text
                style={{
                  fontFamily: ed.typography.dataMd.fontFamily,
                  fontSize: ed.typography.dataMd.fontSize,
                  color: vialInsufficient ? ed.colors.stateWarn : ed.colors.ink1,
                }}
              >
                {vial.remaining_mg.toFixed(2)} / {vial.strength_mg} mg
              </Text>
            </View>
          ) : (
            <View
              style={{
                marginTop: 14,
                paddingVertical: 14,
                paddingHorizontal: 14,
                borderTopWidth: 1,
                borderBottomWidth: 1,
                borderColor: ed.colors.brandLine,
              }}
            >
              <Text
                style={{
                  fontFamily: ed.typography.bodySm.fontFamily,
                  fontSize: ed.typography.bodySm.fontSize,
                  color: ed.colors.ink2,
                  marginBottom: 8,
                }}
              >
                No active vial for {peptide?.name ?? 'this peptide'}.
              </Text>
              <Pressable
                onPress={() =>
                  router.replace({ pathname: '/reconstitute', params: { peptideId } } as any)
                }
                hitSlop={4}
              >
                <Text
                  style={{
                    fontFamily: ed.typography.label.fontFamily,
                    fontSize: ed.typography.label.fontSize,
                    letterSpacing: ed.typography.label.letterSpacing,
                    color: ed.colors.brand,
                    textTransform: 'uppercase',
                  }}
                >
                  Reconstitute a new vial →
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Vial picker — only shown when multiple */}
        {peptideVials.length > 1 ? (
          <View style={{ marginTop: 28, paddingHorizontal: 24 }}>
            <EyebrowLabel withRule>{`Vial · ${peptideVials.length} active`}</EyebrowLabel>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingVertical: 14 }}
            >
              {peptideVials.map((v) => {
                const active = vial?.id === v.id;
                const reconDate = new Date(v.reconstituted_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                });
                return (
                  <Pressable
                    key={v.id}
                    onPress={() => setVial(v)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    style={{
                      paddingVertical: 12,
                      paddingHorizontal: 14,
                      backgroundColor: active ? ed.colors.ink1 : 'transparent',
                      borderWidth: 1,
                      borderColor: active ? ed.colors.ink1 : ed.colors.lineStrong,
                      minWidth: 150,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: ed.typography.dataMd.fontFamily,
                        fontSize: ed.typography.dataMd.fontSize,
                        color: active ? ed.colors.bg : ed.colors.ink1,
                      }}
                    >
                      {v.remaining_mg.toFixed(2)} / {v.strength_mg} mg
                    </Text>
                    <Text
                      style={{
                        marginTop: 4,
                        fontFamily: ed.typography.labelSm.fontFamily,
                        fontSize: ed.typography.labelSm.fontSize,
                        letterSpacing: ed.typography.labelSm.letterSpacing,
                        color: active ? ed.colors.bg : ed.colors.ink3,
                        textTransform: 'uppercase',
                      }}
                    >
                      Recon {reconDate}
                      {v.expires_at
                        ? ` · exp ${new Date(v.expires_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}`
                        : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {/* Injection site */}
        <View style={{ marginTop: 28, paddingHorizontal: 24 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <EyebrowLabel withRule>{site ? `Site · ${site}` : 'Injection site'}</EyebrowLabel>
            <Pressable onPress={() => router.push('/injection-sites' as any)} hitSlop={6}>
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
                Body map
              </Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingVertical: 14 }}
          >
            {INJECTION_SITES.map((s) => {
              const active = s === site;
              return (
                <Pressable
                  key={s}
                  onPress={() => setSite(s)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 14,
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
                    {s}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Pressable onPress={() => setSite(null)} hitSlop={6}>
            <Text
              style={{
                fontFamily: ed.typography.labelSm.fontFamily,
                fontSize: ed.typography.labelSm.fontSize,
                letterSpacing: ed.typography.labelSm.letterSpacing,
                color: ed.colors.ink3,
                textTransform: 'uppercase',
              }}
            >
              Clear site
            </Text>
          </Pressable>
        </View>

        {/* Route */}
        <View style={{ marginTop: 28, paddingHorizontal: 24 }}>
          <EyebrowLabel withRule>Route</EyebrowLabel>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
            {ROUTES.map((r) => {
              const active = r === route;
              return (
                <Pressable
                  key={r}
                  onPress={() => setRoute(r)}
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
                    {r}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* When — DateTimeField owns the expand/collapse + steppers */}
        <View style={{ marginTop: 28, paddingHorizontal: 24 }}>
          <DateTimeField value={takenAtDate} onChange={setTakenAtDate} label="When" />
        </View>

        {/* Note */}
        <View style={{ marginTop: 28, paddingHorizontal: 24 }}>
          <EyebrowLabel withRule>Note · optional</EyebrowLabel>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="How do you feel? Side effects, observations…"
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
              minHeight: 100,
              textAlignVertical: 'top',
            }}
          />
        </View>

        {/* Disclaimer + save */}
        <View style={{ marginTop: 28, paddingHorizontal: 24 }}>
          <DosingDisclaimer />
        </View>
        <View style={{ marginTop: 24, paddingHorizontal: 24 }}>
          <EditorialButton
            fullWidth
            onPress={save}
            disabled={saving || vialInsufficient || !peptideId}
          >
            {saving ? 'Logging…' : 'Log dose'}
          </EditorialButton>
        </View>
      </ScrollView>
    </View>
  );
}

