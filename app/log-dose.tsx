// Log dose — spec v2.0 §10. Modal. Real writes to SQLite.
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconChevronRight, IconClock, IconClose } from '../components/Icons';
import { HCodeAvatar } from '../components/Primitives';
import {
  getActiveVial,
  listActiveVials,
  logDose,
  siteSuggestion,
  INJECTION_SITES,
  type Vial,
} from '../lib/db';
import { PEPTIDES, findPeptide } from '../lib/peptides';
import { useTheme } from '../theme/ThemeContext';
import { font, radius, space } from '../theme/tokens';

const ROUTES = ['SubQ', 'IM', 'Oral', 'Topical', 'Intranasal'] as const;
type Route = (typeof ROUTES)[number];

export default function LogDoseModal() {
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [showPeptidePicker, setShowPeptidePicker] = useState(false);
  const [showSitePicker, setShowSitePicker] = useState(false);
  const [peptideId, setPeptideId] = useState<string>('');
  const [amountMcg, setAmountMcg] = useState(100);
  const [route, setRoute] = useState<Route>('SubQ');
  const [site, setSite] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [vial, setVial] = useState<Vial | null>(null);
  const [saving, setSaving] = useState(false);

  const peptide = peptideId ? findPeptide(peptideId) : null;

  // Load the most recent active vial as the default peptide
  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [vs, sug] = await Promise.all([listActiveVials(), siteSuggestion()]);
        if (vs.length && !peptideId) {
          setPeptideId(vs[0].peptide_id);
          setVial(vs[0]);
        } else if (!peptideId && PEPTIDES.length) {
          setPeptideId(PEPTIDES[0].id);
        }
        if (!site) setSite(sug.site);
      })();
    }, [])
  );

  // When peptide changes, load its active vial
  useEffect(() => {
    if (!peptideId) return;
    getActiveVial(peptideId).then(setVial);
  }, [peptideId]);

  const volumeUnits = useMemo(() => {
    if (!vial) return null;
    const volume_ml = amountMcg / (vial.concentration * 1000);
    const units = volume_ml * 100;
    return { units, volume_ml };
  }, [vial, amountMcg]);

  const vialInsufficient = !!vial && amountMcg / 1000 > vial.remaining_mg;

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

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {/* Top bar */}
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
        {/* Peptide selector */}
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
              maxHeight: 260,
              backgroundColor: t.surface,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: t.line,
            }}
          >
            <ScrollView>
              {PEPTIDES.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => {
                    setPeptideId(p.id);
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
                  <Text style={{ flex: 1, color: t.ink, fontSize: 14, fontFamily: font.sansMed }}>
                    {p.name}
                  </Text>
                  <Text style={{ fontSize: 11, color: t.ink3 }}>{p.class.split('/')[0].trim()}</Text>
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
              <Text
                style={{
                  fontSize: 56,
                  fontFamily: font.monoSemi,
                  color: t.ink,
                  letterSpacing: -2,
                  lineHeight: 58,
                }}
              >
                {amountMcg}
              </Text>
              <Text
                style={{
                  fontSize: 20,
                  color: t.ink3,
                  fontFamily: font.sansMed,
                  marginLeft: 6,
                }}
              >
                mcg
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: space.md }}>
              {[-100, -25, +25, +100].map((delta) => (
                <Pressable
                  key={delta}
                  onPress={() => setAmountMcg((v) => Math.max(1, v + delta))}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    borderRadius: radius.pill,
                    backgroundColor: t.surfaceAlt,
                  }}
                >
                  <Text style={{ fontSize: 13, fontFamily: font.monoSemi, color: t.ink }}>
                    {delta > 0 ? `+${delta}` : delta}
                  </Text>
                </Pressable>
              ))}
            </View>

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
                <Pressable onPress={() => router.replace('/reconstitute')}>
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
            onPress={() => setShowSitePicker(!showSitePicker)}
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
            <Text style={{ fontSize: 11, color: t.accent, marginTop: 2 }}>Suggested</Text>
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

        {showSitePicker ? (
          <View
            style={{
              marginHorizontal: space.xl,
              marginTop: 4,
              padding: space.md,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: t.line,
              backgroundColor: t.surface,
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 6,
            }}
          >
            {INJECTION_SITES.map((s) => {
              const active = s === site;
              return (
                <Pressable
                  key={s}
                  onPress={() => {
                    setSite(s);
                    setShowSitePicker(false);
                  }}
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
                    {s}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

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

        {/* Confirm */}
        <View style={{ paddingHorizontal: space.xl, marginTop: space.xl }}>
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
