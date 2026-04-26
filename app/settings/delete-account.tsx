// Delete all data — spec v2.0 §10. Destructive, type-to-confirm.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconChevronLeft } from '../../components/Icons';
import { deleteAllUserData } from '../../lib/db';
import { useProfile } from '../../lib/profile-context';
import { useTheme } from '../../theme/ThemeContext';
import { font, radius, space } from '../../theme/tokens';

const CONFIRM_PHRASE = 'delete everything';

export default function DeleteAccount() {
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refresh } = useProfile();
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false);

  const canDelete = phrase.trim().toLowerCase() === CONFIRM_PHRASE;

  const runDelete = async () => {
    if (!canDelete || busy) return;
    setBusy(true);
    await deleteAllUserData();
    await refresh();
    router.replace('/welcome');
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <View
        style={{
          paddingTop: insets.top + space.sm,
          paddingBottom: space.md,
          paddingHorizontal: space.xl,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <IconChevronLeft size={18} color={t.ink2} />
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: space.xl, gap: space.lg }}>
        <Text style={{ fontSize: 28, fontFamily: font.sansBold, color: t.danger, letterSpacing: -0.6 }}>
          Delete all data
        </Text>

        <View
          style={{
            padding: space.md,
            borderRadius: radius.md,
            backgroundColor: t.dangerSoft,
            borderLeftWidth: 3,
            borderLeftColor: t.danger,
          }}
        >
          <Text style={{ color: t.ink, fontSize: 14, lineHeight: 20 }}>
            This permanently deletes every dose, vial, cycle, stack, journal entry,
            metric, and preference on this device. It cannot be undone.
          </Text>
        </View>

        <View style={{ gap: 6 }}>
          <Text
            style={{
              fontSize: 11,
              letterSpacing: 0.9,
              fontFamily: font.sansSemi,
              color: t.ink3,
              textTransform: 'uppercase',
            }}
          >
            {`Type "${CONFIRM_PHRASE}" to confirm`}
          </Text>
          <TextInput
            value={phrase}
            onChangeText={setPhrase}
            placeholder={CONFIRM_PHRASE}
            placeholderTextColor={t.ink4}
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              backgroundColor: t.surface,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: canDelete ? t.danger : t.line,
              padding: space.md,
              color: t.ink,
              fontSize: 15,
              fontFamily: font.mono,
            }}
          />
        </View>

        <Pressable
          onPress={runDelete}
          disabled={!canDelete || busy}
          style={{
            padding: space.lg,
            borderRadius: radius.md,
            backgroundColor: canDelete && !busy ? t.danger : t.surfaceAlt,
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              color: canDelete && !busy ? '#fff' : t.ink3,
              fontSize: 15,
              fontFamily: font.sansSemi,
            }}
          >
            {busy ? 'Deleting…' : 'Delete all data'}
          </Text>
        </Pressable>

        <Pressable onPress={() => router.back()} style={{ alignItems: 'center', padding: space.md }}>
          <Text style={{ color: t.accent, fontSize: 14, fontFamily: font.sansSemi }}>
            Changed your mind? Go back.
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
