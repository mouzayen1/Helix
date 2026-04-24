// Log dose — spec v2.0 §10 + extras.
// Sections: Your vials (top) + All peptides (below). Tap non-vial -> recon.
// Typed dose input + smart preset chips from peptide's research range.
// Prefill dose from active cycle's today protocol when peptide matches.
// Site card opens /injection-sites modal.
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconChevronRight, IconClock, IconClose } from '../components/Icons';
import { DosingDisclaimer, HCodeAvatar } from '../components/Primitives';
import {
  getActiveCycle,
  getActiveVial,
  INJECTION_SITES,
  listActiveVials,
  logDose,
  siteSuggestion,
  type Cycle,
  type Vial,
} from '../lib/db';
import { findPeptide, PEPTIDES } from '../lib/peptides';
import { useTheme } from '../theme/ThemeContext';
import { font, radius, space } from '../theme/tokens';

const ROUTES = ['SubQ', 'IM', 'Oral', 'Topical', 'Intranasal'] as const;
type Route = (typeof ROUTES)[number];

// Parse a peptide's research dose like "200–500 mcg/day" to numeric range.
function parseDoseRange(dose: string): { lo: number; mid: number; hi: number } {
  const nums = [...dose.matchAll(/(\d+(?:\.\d+)?)/g)].map((m) => parseFloat(m[1]));
  if (nums.length === 0) return { lo: 100, mid: 250, hi: 500 };
  // If values are in mg (look for 'mg' immediately before or after), convert to mcg.
  const mgMatch = /\d\s*(?:–|-)\s*\d(?:\.\d+)?\s*mg/.test(dose);
  const factor = mgMatch ? 1000 : 1;
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
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { peptideId: initialId, prefillDoseMcg } = useLocalSearchParams<{
    peptideId?: string;
    prefillDoseMcg?: string;
  }>();

  const [showPeptidePicker, setShowPeptidePicker] = useState(false);
  const [peptideId, setPeptideId] = useState<string>(initialId || '');
  const [amountMcg, setAmountMcg] = useState(100);
  const [amountText, setAmountText] = useState('100');
  const [route, setRoute] = useState<Route>('SubQ');
  const [site, setSite] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [vial, setVial] = useState<Vial | null>(null);
  const [vials, setVials] = useState<Vial[]>([]);
  const [activeCycle, setActiveCycle] = useState<Cycle | null>(null);
  const [saving, setSaving] = useState(false);

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
          // Default: first vial's peptide if any, else first peptide in catalog.
          if (vs.length) {
            setPeptideId(vs[0].peptide_id);
            setVial(vs[0]);
          } else if (PEPTIDES.length) {
            setPeptideId(PEPTIDES[0].id);
          }
        }
        if (!site) setSite(sug.site);
      })();
    }, [])
  );

  useEffect(() => {
    if (!peptideId) return;
    getActiveVial(peptideId).then(setVial);
  }, [peptideId]);

  // Prefill dose from active cycle's today protocol, or from query param.
  useEffect(() => {
    if (!peptideId) return;
    if (prefillDoseMcg) {
      const n = parseFloat(prefillDoseMcg);
      if (!isNaN(n) && n > 0) {
        setAmountMcg(n);
        setAmountText(String(n));
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
          setAmountMcg(match.dose_mcg);
          setAmountText(String(match.dose_mcg));
          return;
        }
      } catch {}
    }
    // Fall back to the peptide's research-range midpoint.
    const p = findPeptide(peptideId);
    if (p?.dose) {
      const { mid } = parseDoseRange(p.dose);
      setAmountMcg(mid);
      setAmountText(String(mid));
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
    if (!peptide?.dose) return [100, 250, 500];
    const { lo, mid, hi } = parseDoseRange(peptide.dose);
    return [lo, mid, hi];
  }, [peptide?.dose]);

  const commitDose = () => {
    const n = parseFloat(amountText);
    if (isNaN(n) || n <= 0 || n > 100000) {
      setAmountText(String(amountMcg));
    } else {
      setAmountMcg(n);
      setAmountText(String(n));
    }
  };

  const save = async () => {
    if (!peptideId || saving) return;
    setSaving(true);
    try {
      await logDose({
        peptide_id: peptideId,
        vial_id: vial?.id ?? null,
        amount_mcg: amountMcg,
        volume_units: volumeUnits?.units,
        route,
        site,
        taken_at: new Date().toISOString(),
        note: note.trim() || undefined,
      });
      router.back();
    } catch (err) {
      console.warn('log dose failed', err);
      setSaving(false);
    }
  };

  // Peptides that already have a vial vs not — used for picker sections.
  const vialPeptideIds = useMemo(() => new Set(vials.map((v) => v.peptide_id)), [vials]);
  const peptidesWithoutVial = useMemo(
    () => PEPTIDES.filter((p) => !vialPeptideIds.has(p.id)),
    [vialPeptideIds]
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: insets.top + space.md,
          paddingBottom: space.md,
          paddingHorizontal: space.xl,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <IconClose size={16} color={t.ink3} />
        </Pressable>
        <Text style={{ fontSize: 15, fontFamily: font.sansSemi, color: t.ink }}>Log dose</Text>
        <Pressable
          onPress={save}
          disabled={saving || vialInsufficient || !peptideId}
          hitSlop={10}
        >
          <Text
            style={{
              fontSize: 14,
              color: saving || vialInsufficient || !peptideId ? t.ink3 : t.accent,
              fontFamily: font.sansSemi,
            }}
          >
            Save
          </Text>
        </Pressable>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + space['2xl'] }}
      >
        {/* Peptide selector card */}
        <View style={{ paddingHorizontal: space.xl }}>
          <Pressable
            onPress={() => setShowPeptidePicker(!showPeptidePicker)}
            style={{
              backgroundColor: t.surface,
              borderRadius: radius.lg,
              padding: space.lg,
              borderWidth: 1,
              borderColor: t.line,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
            }}
          >
            {peptide ? (
              <>
                <HCodeAvatar id={peptide.name.replace(/[^A-Za-z]/g, '').slice(0, 3)} color={peptide.color} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontFamily: font.sansSemi, color: t.ink }}>
                    {peptide.name}
                  </Text>
                  <Text style={{ fontSize: 12, color: t.ink3, fontFamily: font.mono }}>
                    {peptide.formula}
                  </Text>
                </View>
              </>
            ) : (
              <Text style={{ flex: 1, color: t.ink3, fontSize: 14 }}>Select peptide</Text>
            )}
            <IconChevronRight size={14} color={t.ink3} />
          </Pressable>
        </View>

        {showPeptidePicker ? (
          <View
            style={{
              marginHorizontal: space.xl,
              marginTop: 4,
              height: 380,
              backgroundColor: t.surface,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: t.line,
            }}
          >
            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
              {/* Your vials section */}
              {vials.length > 0 ? (
                <View>
                  <Text
                    style={{
                      padding: 10,
                      paddingBottom: 4,
                      fontSize: 10,
                      letterSpacing: 1,
                      color: t.ink3,
                      fontFamily: font.sansSemi,
                      textTransform: 'uppercase',
                    }}
                  >
                    Your vials
                  </Text>
                  {vials.map((v) => {
                    const p = findPeptide(v.peptide_id);
                    if (!p) return null;
                    return (
                      <Pressable
                        key={v.id}
                        onPress={() => {
                          setPeptideId(p.id);
                          setVial(v);
                          setShowPeptidePicker(false);
                        }}
                        style={{
                          padding: space.md,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 10,
                          borderBottomWidth: 1,
                          borderBottomColor: t.line,
                        }}
                      >
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: p.color,
                          }}
                        />
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              color: t.ink,
                              fontSize: 14,
                              fontFamily: font.sansSemi,
                            }}
                          >
                            {p.name}
                          </Text>
                          <Text
                            style={{
                              color: t.ink3,
                              fontSize: 11,
                              fontFamily: font.mono,
                              marginTop: 2,
                            }}
                          >
                            {v.remaining_mg.toFixed(2)} / {v.strength_mg} mg
                          </Text>
                        </View>
                        <Text
                          style={{
                            color: t.accent,
                            fontSize: 11,
                            fontFamily: font.sansSemi,
                          }}
                        >
                          Vial
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              {/* All peptides section */}
              <Text
                style={{
                  padding: 10,
                  paddingBottom: 4,
                  marginTop: vials.length > 0 ? 4 : 0,
                  fontSize: 10,
                  letterSpacing: 1,
                  color: t.ink3,
                  fontFamily: font.sansSemi,
                  textTransform: 'uppercase',
                }}
              >
                {vials.length > 0 ? 'Other peptides · tap to reconstitute' : 'All peptides'}
              </Text>
              {peptidesWithoutVial.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => {
                    setShowPeptidePicker(false);
                    router.replace({
                      pathname: '/reconstitute',
                      params: { peptideId: p.id },
                    } as any);
                  }}
                  style={{
                    padding: space.md,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: t.line,
                  }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: p.color,
                    }}
                  />
                  <Text
                    style={{
                      flex: 1,
                      color: t.ink,
                      fontSize: 14,
                      fontFamily: font.sansMed,
                    }}
                  >
                    {p.name}
                  </Text>
                  <Text style={{ fontSize: 11, color: t.ink3 }}>
                    {p.class.split('/')[0].trim()}
                  </Text>
                  <IconChevronRight size={12} color={t.ink4} />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Dose */}
        <View style={{ paddingHorizontal: space.xl, marginTop: space.xl }}>
          <Text
            style={{
              fontSize: 11,
              fontFamily: font.sansSemi,
              letterSpacing: 1.2,
              color: t.ink3,
              marginBottom: 10,
              textTransform: 'uppercase',
            }}
          >
            Dose
          </Text>
          <View
            style={{
              backgroundColor: t.surface,
              borderRadius: radius.lg,
              paddingVertical: space.xl,
              paddingHorizontal: space.lg,
              borderWidth: 1,
              borderColor: t.line,
              alignItems: 'center',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <TextInput
                value={amountText}
                onChangeText={setAmountText}
                onBlur={commitDose}
                onSubmitEditing={commitDose}
                keyboardType="decimal-pad"
                returnKeyType="done"
                style={{
                  fontSize: 48,
                  fontFamily: font.monoSemi,
                  color: t.ink,
                  letterSpacing: -1,
                  padding: 0,
                  minWidth: 100,
                  textAlign: 'center',
                }}
              />
              <Text
                style={{
                  fontSize: 18,
                  color: t.ink3,
                  fontFamily: font.sansMed,
                  marginLeft: 6,
                }}
              >
                mcg
              </Text>
            </View>

            {/* Smart preset chips from peptide's research range */}
            <View style={{ flexDirection: 'row', gap: 6, marginTop: space.md, flexWrap: 'wrap', justifyContent: 'center' }}>
              {presets.map((preset) => {
                const active = preset === amountMcg;
                return (
                  <Pressable
                    key={preset}
                    onPress={() => {
                      setAmountMcg(preset);
                      setAmountText(String(preset));
                    }}
                    style={{
                      paddingVertical: 7,
                      paddingHorizontal: 12,
                      borderRadius: radius.pill,
                      backgroundColor: active ? t.ink : t.surfaceAlt,
                      borderWidth: 1,
                      borderColor: active ? t.ink : t.line,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: font.monoSemi,
                        color: active ? t.bg : t.ink,
                      }}
                    >
                      {preset} mcg
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {peptide?.dose ? (
              <Text
                style={{
                  marginTop: 6,
                  fontSize: 10,
                  color: t.ink3,
                  fontFamily: font.mono,
                  textAlign: 'center',
                }}
              >
                Research range: {peptide.dose}
              </Text>
            ) : null}

            {volumeUnits ? (
              <Text
                style={{
                  marginTop: space.md,
                  fontSize: 12,
                  color: t.ink3,
                  fontFamily: font.mono,
                }}
              >
                ≈ {volumeUnits.units.toFixed(1)} units · {volumeUnits.volume_ml.toFixed(2)} mL
              </Text>
            ) : null}

            {vial ? (
              <View
                style={{
                  marginTop: space.md,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  backgroundColor: vialInsufficient ? t.dangerSoft : t.surfaceAlt,
                  borderRadius: 10,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  width: '100%',
                }}
              >
                <Text style={{ fontSize: 11, color: t.ink3, letterSpacing: 0.3 }}>
                  {vialInsufficient ? 'NOT ENOUGH IN VIAL' : 'Vial remaining'}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: font.monoSemi,
                    color: vialInsufficient ? t.danger : t.ink,
                  }}
                >
                  {vial.remaining_mg.toFixed(2)} / {vial.strength_mg} mg
                </Text>
              </View>
            ) : (
              <View
                style={{
                  marginTop: space.md,
                  width: '100%',
                  padding: space.md,
                  borderRadius: radius.md,
                  backgroundColor: t.warnSoft + '80',
                  borderWidth: 1,
                  borderColor: t.warn + '40',
                }}
              >
                <Text style={{ fontSize: 12, color: t.ink2, marginBottom: 6 }}>
                  No active vial for {peptide?.name ?? 'this peptide'}.
                </Text>
                <Pressable
                  onPress={() =>
                    router.replace({
                      pathname: '/reconstitute',
                      params: { peptideId },
                    } as any)
                  }
                >
                  <Text style={{ fontSize: 13, color: t.accent, fontFamily: font.sansSemi }}>
                    Reconstitute a new vial →
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>

        {/* Site + Route */}
        <View style={{ paddingHorizontal: space.xl, marginTop: space.md, flexDirection: 'row', gap: 8 }}>
          <Pressable
            onPress={() => router.push('/injection-sites' as any)}
            style={{
              flex: 1,
              backgroundColor: t.surface,
              borderRadius: radius.md,
              padding: space.md,
              borderWidth: 1,
              borderColor: t.line,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                letterSpacing: 0.8,
                color: t.ink3,
                fontFamily: font.sansSemi,
                textTransform: 'uppercase',
              }}
            >
              Site
            </Text>
            <Text
              style={{
                fontSize: 15,
                fontFamily: font.sansSemi,
                color: t.ink,
                marginTop: 6,
              }}
            >
              {site ?? '—'}
            </Text>
            <Text style={{ fontSize: 11, color: t.accent, marginTop: 2 }}>
              Tap to open body map
            </Text>
          </Pressable>
          <View
            style={{
              flex: 1,
              backgroundColor: t.surface,
              borderRadius: radius.md,
              padding: space.md,
              borderWidth: 1,
              borderColor: t.line,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                letterSpacing: 0.8,
                color: t.ink3,
                fontFamily: font.sansSemi,
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              Route
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
              {ROUTES.slice(0, 3).map((r) => {
                const active = r === route;
                return (
                  <Pressable
                    key={r}
                    onPress={() => setRoute(r)}
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: radius.pill,
                      backgroundColor: active ? t.ink : 'transparent',
                      borderWidth: 1,
                      borderColor: active ? t.ink : t.line,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        color: active ? t.bg : t.ink2,
                        fontFamily: font.sansMed,
                      }}
                    >
                      {r}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* Time */}
        <View style={{ paddingHorizontal: space.xl, marginTop: space.md }}>
          <View
            style={{
              backgroundColor: t.surface,
              borderRadius: radius.md,
              padding: space.md,
              borderWidth: 1,
              borderColor: t.line,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <IconClock size={16} color={t.ink3} />
            <Text style={{ flex: 1, fontSize: 14, color: t.ink }}>
              Now —{' '}
              {new Date().toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </Text>
          </View>
        </View>

        {/* Note */}
        <View style={{ paddingHorizontal: space.xl, marginTop: space.md }}>
          <View
            style={{
              backgroundColor: t.surface,
              borderRadius: radius.md,
              padding: space.md,
              borderWidth: 1,
              borderColor: t.line,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                letterSpacing: 0.8,
                color: t.ink3,
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
              placeholder="How do you feel? Side effects, observations…"
              placeholderTextColor={t.ink4}
              multiline
              style={{
                color: t.ink,
                fontSize: 14,
                minHeight: 40,
                padding: 0,
                textAlignVertical: 'top',
              }}
            />
          </View>
        </View>

        {/* Inline disclaimer */}
        <View style={{ paddingHorizontal: space.xl, marginTop: space.md }}>
          <DosingDisclaimer />
        </View>

        {/* Confirm */}
        <View style={{ paddingHorizontal: space.xl, marginTop: space.md }}>
          <Pressable
            onPress={save}
            disabled={saving || vialInsufficient || !peptideId}
            style={{
              padding: space.lg,
              borderRadius: radius.lg,
              backgroundColor:
                saving || vialInsufficient || !peptideId ? t.surfaceAlt : t.ink,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontSize: 15,
                fontFamily: font.sansSemi,
                color:
                  saving || vialInsufficient || !peptideId ? t.ink3 : t.bg,
              }}
            >
              {saving ? 'Logging…' : 'Log dose'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
