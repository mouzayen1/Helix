// Library — spec v2.0 §10 "Library home". Full 42-peptide catalog.
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconChevronRight, IconSearch } from '../../components/Icons';
import { HCodeAvatar, HSectionHeader, HTag } from '../../components/Primitives';
import { listSavedPeptides } from '../../lib/db';
import { PEPTIDE_CLASSES, PEPTIDES, peptideClassTopLevel, type Peptide } from '../../lib/peptides';
import { useTheme } from '../../theme/ThemeContext';
import { font, radius, space } from '../../theme/tokens';

export default function LibraryScreen() {
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState('');
  const [activeCat, setActiveCat] = useState<string>('All');
  const [saved, setSaved] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      listSavedPeptides().then(setSaved);
    }, [])
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PEPTIDES.filter((p) => {
      if (activeCat !== 'All' && peptideClassTopLevel(p.class) !== activeCat) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.subtitle.toLowerCase().includes(q) ||
        p.class.toLowerCase().includes(q) ||
        p.stacks.some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [query, activeCat]);

  const savedPeptides = useMemo(
    () => saved.map((id) => PEPTIDES.find((p) => p.id === id)).filter(Boolean) as Peptide[],
    [saved]
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + space.md,
          paddingBottom: 140,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ paddingHorizontal: space.xl }}>
          <Text
            style={{
              fontSize: 28,
              fontFamily: font.sansBold,
              color: t.ink,
              letterSpacing: -0.6,
            }}
          >
            Library
          </Text>
          <Text style={{ fontSize: 13, color: t.ink3, marginTop: 2 }}>
            {PEPTIDES.length} peptides · research-grade monographs
          </Text>

          {/* Search */}
          <View
            style={{
              marginTop: space.md,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              backgroundColor: t.surface,
              borderWidth: 1,
              borderColor: t.line,
              borderRadius: radius.md,
              paddingHorizontal: 14,
            }}
          >
            <IconSearch size={16} color={t.ink3} />
            <TextInput
              placeholder="Search peptide, class, or effect"
              placeholderTextColor={t.ink3}
              value={query}
              onChangeText={setQuery}
              style={{
                flex: 1,
                color: t.ink,
                fontFamily: font.sans,
                fontSize: 14,
                paddingVertical: 11,
              }}
            />
          </View>
        </View>

        {/* Class chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: space.xl,
            gap: 6,
            marginTop: space.md,
          }}
          style={{ flexGrow: 0 }}
        >
          {PEPTIDE_CLASSES.map((c) => {
            const active = c === activeCat;
            return (
              <Pressable
                key={c}
                onPress={() => setActiveCat(c)}
                style={{
                  paddingVertical: 7,
                  paddingHorizontal: 13,
                  borderRadius: radius.pill,
                  backgroundColor: active ? t.ink : 'transparent',
                  borderWidth: 1,
                  borderColor: active ? t.ink : t.line,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: font.sansMed,
                    color: active ? t.bg : t.ink2,
                    letterSpacing: 0.3,
                  }}
                >
                  {c}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Saved section */}
        {savedPeptides.length > 0 ? (
          <>
            <HSectionHeader title="Saved" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: space.xl, gap: 10 }}
            >
              {savedPeptides.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => router.push(`/peptide/${p.id}` as any)}
                  style={{
                    minWidth: 160,
                    backgroundColor: t.surface,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: t.line,
                    padding: space.md,
                  }}
                >
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <View
                      style={{
                        width: 6,
                        height: 22,
                        borderRadius: 3,
                        backgroundColor: p.color,
                      }}
                    />
                    <Text style={{ fontSize: 14, fontFamily: font.sansSemi, color: t.ink }}>
                      {p.name}
                    </Text>
                  </View>
                  <Text
                    style={{ fontSize: 11, color: t.ink3, marginTop: 4 }}
                    numberOfLines={1}
                  >
                    {peptideClassTopLevel(p.class)} · t½ {p.halfLife}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : null}

        {/* Full catalog */}
        <HSectionHeader
          title={
            query
              ? `${filtered.length} result${filtered.length === 1 ? '' : 's'}`
              : 'All peptides'
          }
        />
        {filtered.length === 0 ? (
          <View
            style={{
              marginHorizontal: space.xl,
              padding: space.xl,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: t.line,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: t.ink, fontFamily: font.sansSemi, fontSize: 15 }}>
              No peptides match.
            </Text>
            <Text
              style={{
                color: t.ink3,
                fontSize: 13,
                marginTop: 4,
                textAlign: 'center',
              }}
            >
              Try a different search term or clear the filter.
            </Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: space.xl, gap: 8 }}>
            {filtered.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => router.push(`/peptide/${p.id}` as any)}
                style={{
                  backgroundColor: t.surface,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: t.line,
                  padding: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <View
                  style={{
                    width: 4,
                    alignSelf: 'stretch',
                    borderRadius: 2,
                    backgroundColor: p.color,
                  }}
                />
                <HCodeAvatar id={p.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 3)} color={p.color} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'baseline' }}>
                    <Text style={{ fontSize: 15, fontFamily: font.sansSemi, color: t.ink }}>
                      {p.name}
                    </Text>
                    <Text style={{ fontSize: 10, color: t.ink3, fontFamily: font.sansSemi, letterSpacing: 0.5 }}>
                      {peptideClassTopLevel(p.class)}
                    </Text>
                  </View>
                  <Text
                    style={{ fontSize: 12, color: t.ink3, marginTop: 2 }}
                    numberOfLines={1}
                  >
                    {p.subtitle}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 4, marginTop: 6, alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, color: t.ink3, fontFamily: font.mono }}>
                      t½ {p.halfLife}
                    </Text>
                    {p.citations.length > 0 ? (
                      <Text style={{ fontSize: 11, color: t.ink3, fontFamily: font.mono }}>
                        {' · '}
                        {p.citations.length} cite{p.citations.length === 1 ? '' : 's'}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <IconChevronRight size={14} color={t.ink4} />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
