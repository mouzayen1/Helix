// Library — editorial rebuild. Same data flow (search, saved filter,
// class filter) — all visual chrome reworked: hairline search input,
// mono-uppercase class chips with sharp corners, hairline-divided
// catalog list with color hairline + serif name + mono metadata.
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EditorialHeadline } from '../../components/editorial/EditorialHeadline';
import { EyebrowLabel } from '../../components/editorial/EyebrowLabel';
import { HairlineRow } from '../../components/editorial/HairlineRow';
import { useEditorialTheme } from '../../lib/design/theme';
import { listSavedPeptides } from '../../lib/db';
import {
  PEPTIDE_CLASSES,
  PEPTIDES,
  peptideClassTopLevel,
  type Peptide,
} from '../../lib/peptides';

export default function LibraryScreen() {
  const ed = useEditorialTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeCat, setActiveCat] = useState<string>('All');
  const [savedOnly, setSavedOnly] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const savedSet = useMemo(() => new Set(saved), [saved]);

  useFocusEffect(
    useCallback(() => {
      listSavedPeptides().then(setSaved);
    }, [])
  );

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 150);
    return () => clearTimeout(id);
  }, [query]);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    return PEPTIDES.filter((p) => {
      if (activeCat !== 'All' && peptideClassTopLevel(p.class) !== activeCat) return false;
      if (savedOnly && !savedSet.has(p.id)) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.subtitle.toLowerCase().includes(q) ||
        p.class.toLowerCase().includes(q) ||
        (p.summary && p.summary.toLowerCase().includes(q)) ||
        p.stacks.some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [debouncedQuery, activeCat, savedOnly, savedSet]);

  const savedPeptides = useMemo(
    () => saved.map((id) => PEPTIDES.find((p) => p.id === id)).filter(Boolean) as Peptide[],
    [saved]
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: ed.colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 140 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={{ paddingHorizontal: 24 }}>
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
          {`Library · ${PEPTIDES.length}`}
        </Text>
        <EditorialHeadline size="title1">{`The *catalog*.`}</EditorialHeadline>
        <Text
          style={{
            marginTop: 8,
            fontFamily: ed.typography.bodySm.fontFamily,
            fontSize: ed.typography.bodySm.fontSize,
            lineHeight: ed.typography.bodySm.lineHeight,
            color: ed.colors.ink3,
          }}
        >
          Research-grade monographs.
        </Text>

        {/* Search */}
        <View
          style={{
            marginTop: 24,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: ed.colors.line,
            paddingVertical: 8,
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
            ⌕
          </Text>
          <TextInput
            placeholder="SEARCH PEPTIDE, CLASS, EFFECT"
            placeholderTextColor={ed.colors.ink3}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            selectionColor={ed.colors.brand}
            accessibilityLabel="Search peptides"
            style={{
              flex: 1,
              fontFamily: ed.typography.dataMd.fontFamily,
              fontSize: ed.typography.dataMd.fontSize,
              letterSpacing: 0.4,
              color: ed.colors.ink1,
              paddingVertical: 10,
            }}
            autoCapitalize="characters"
          />
          {query.length > 0 ? (
            <Pressable
              onPress={() => setQuery('')}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Text
                style={{
                  fontFamily: ed.fraunces('Fraunces_300Light'),
                  fontSize: 22,
                  color: ed.colors.ink3,
                  lineHeight: 22,
                }}
              >
                ×
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => setSavedOnly((v) => !v)}
            accessibilityRole="switch"
            accessibilityState={{ checked: savedOnly }}
            accessibilityLabel="Saved only"
            hitSlop={6}
          >
            <Text
              style={{
                fontFamily: ed.typography.label.fontFamily,
                fontSize: ed.typography.label.fontSize,
                letterSpacing: ed.typography.label.letterSpacing,
                color: savedOnly ? ed.colors.brand : ed.colors.ink3,
                textTransform: 'uppercase',
              }}
            >
              {savedOnly ? '★ Saved' : '☆ Saved'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Class chips — sharp corners, mono. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, gap: 6, marginTop: 18 }}
        style={{ flexGrow: 0 }}
      >
        {PEPTIDE_CLASSES.map((c) => {
          const active = c === activeCat;
          return (
            <Pressable
              key={c}
              onPress={() => setActiveCat(c)}
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
                {c}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Saved horizontal strip */}
      {savedPeptides.length > 0 ? (
        <View style={{ marginTop: 32 }}>
          <View style={{ paddingHorizontal: 24 }}>
            <EyebrowLabel withRule>Saved</EyebrowLabel>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 24, gap: 14, paddingTop: 16 }}
          >
            {savedPeptides.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => router.push(`/peptide/${p.id}` as any)}
                style={{ minWidth: 180, paddingVertical: 4 }}
              >
                <View
                  style={{
                    height: 2,
                    backgroundColor: p.color,
                    marginBottom: 12,
                  }}
                />
                <Text
                  style={{
                    fontFamily: ed.fraunces('Fraunces_400Regular'),
                    fontSize: 19,
                    letterSpacing: -0.3,
                    color: ed.colors.ink1,
                  }}
                  numberOfLines={1}
                >
                  {p.name}
                </Text>
                <Text
                  style={{
                    marginTop: 4,
                    fontFamily: ed.typography.labelSm.fontFamily,
                    fontSize: ed.typography.labelSm.fontSize,
                    letterSpacing: ed.typography.labelSm.letterSpacing,
                    color: ed.colors.ink3,
                    textTransform: 'uppercase',
                  }}
                  numberOfLines={1}
                >
                  {peptideClassTopLevel(p.class)} · t½ {p.halfLife}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* Catalog list */}
      <View style={{ marginTop: 32, paddingHorizontal: 24 }}>
        <EyebrowLabel withRule>
          {query
            ? `${filtered.length} result${filtered.length === 1 ? '' : 's'}`
            : 'All peptides'}
        </EyebrowLabel>
      </View>
      {filtered.length === 0 ? (
        <View style={{ paddingHorizontal: 24, paddingVertical: 40, alignItems: 'center' }}>
          <Text
            style={{
              fontFamily: ed.fraunces('Fraunces_400Regular_Italic'),
              fontSize: 18,
              color: ed.colors.ink2,
            }}
          >
            No matches.
          </Text>
          <Text
            style={{
              marginTop: 6,
              fontFamily: ed.typography.bodySm.fontFamily,
              fontSize: ed.typography.bodySm.fontSize,
              color: ed.colors.ink3,
              textAlign: 'center',
            }}
          >
            Try a different term or clear the filter.
          </Text>
        </View>
      ) : (
        <View style={{ paddingHorizontal: 24, marginTop: 4 }}>
          {filtered.map((p, idx) => (
            <View key={p.id}>
              <Pressable
                onPress={() => router.push(`/peptide/${p.id}` as any)}
                accessibilityRole="button"
                accessibilityLabel={p.name}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 18,
                  gap: 14,
                }}
              >
                {/* Color hairline rule on the left replaces the avatar circle. */}
                <View
                  style={{ width: 2, alignSelf: 'stretch', backgroundColor: p.color }}
                />
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
                    <Text
                      style={{
                        fontFamily: ed.fraunces('Fraunces_400Regular'),
                        fontSize: 19,
                        letterSpacing: -0.3,
                        color: ed.colors.ink1,
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
                      {peptideClassTopLevel(p.class)}
                    </Text>
                    {savedSet.has(p.id) ? (
                      <Text
                        style={{
                          fontFamily: ed.typography.labelSm.fontFamily,
                          fontSize: ed.typography.labelSm.fontSize,
                          color: ed.colors.brand,
                        }}
                      >
                        ★
                      </Text>
                    ) : null}
                  </View>
                  <Text
                    style={{
                      fontFamily: ed.typography.bodySm.fontFamily,
                      fontSize: ed.typography.bodySm.fontSize,
                      color: ed.colors.ink2,
                    }}
                    numberOfLines={1}
                  >
                    {p.subtitle}
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
                    t½ {p.halfLife}
                    {p.citations.length > 0
                      ? ` · ${p.citations.length} cite${p.citations.length === 1 ? '' : 's'}`
                      : ''}
                  </Text>
                </View>
                <Text
                  style={{
                    fontFamily: ed.fraunces('Fraunces_300Light'),
                    fontSize: 24,
                    color: ed.colors.ink3,
                  }}
                >
                  →
                </Text>
              </Pressable>
              {idx < filtered.length - 1 ? <HairlineRow /> : null}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
