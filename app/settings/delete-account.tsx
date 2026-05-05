// Delete all data — editorial rebuild. Destructive, type-to-confirm.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EditorialButton } from '../../components/editorial/EditorialButton';
import { EditorialHeadline } from '../../components/editorial/EditorialHeadline';
import { useEditorialTheme } from '../../lib/design/theme';
import { deleteAllUserData } from '../../lib/db';
import { useProfile } from '../../lib/profile-context';

const CONFIRM_PHRASE = 'delete everything';

export default function DeleteAccount() {
  const ed = useEditorialTheme();
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
      style={{ flex: 1, backgroundColor: ed.colors.bg }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 64 }}
      keyboardShouldPersistTaps="handled"
    >
      <View
        style={{
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
      </View>

      <View style={{ paddingHorizontal: 24 }}>
        <Text
          style={{
            fontFamily: ed.typography.eyebrow.fontFamily,
            fontSize: ed.typography.eyebrow.fontSize,
            letterSpacing: ed.typography.eyebrow.letterSpacing,
            color: ed.colors.stateWarn,
            textTransform: 'uppercase',
            marginBottom: 14,
          }}
        >
          Destructive
        </Text>
        <EditorialHeadline size="title1" color={ed.colors.stateWarn}>
          {`Delete *everything*?`}
        </EditorialHeadline>

        <View
          style={{
            marginTop: 24,
            paddingVertical: 16,
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: ed.colors.stateWarn,
          }}
        >
          <Text
            style={{
              fontFamily: ed.fraunces('Fraunces_400Regular'),
              fontSize: 15,
              lineHeight: 23,
              color: ed.colors.ink1,
            }}
          >
            This permanently deletes every dose, vial, cycle, stack, journal entry, metric, and
            preference on this device. It cannot be undone.
          </Text>
        </View>

        <View style={{ marginTop: 28 }}>
          <Text
            style={{
              fontFamily: ed.typography.label.fontFamily,
              fontSize: ed.typography.label.fontSize,
              letterSpacing: ed.typography.label.letterSpacing,
              color: ed.colors.ink3,
              textTransform: 'uppercase',
              marginBottom: 14,
            }}
          >
            Type "{CONFIRM_PHRASE}" to confirm
          </Text>
          <TextInput
            value={phrase}
            onChangeText={setPhrase}
            placeholder={CONFIRM_PHRASE}
            placeholderTextColor={ed.colors.ink4}
            autoCapitalize="none"
            autoCorrect={false}
            selectionColor={ed.colors.stateWarn}
            style={{
              paddingVertical: 14,
              borderTopWidth: 1,
              borderBottomWidth: 1,
              borderColor: canDelete ? ed.colors.stateWarn : ed.colors.lineStrong,
              fontFamily: ed.typography.dataMd.fontFamily,
              fontSize: 18,
              color: ed.colors.ink1,
              padding: 0,
              paddingHorizontal: 0,
              textAlign: 'center',
            }}
          />
        </View>

        <View style={{ marginTop: 28, gap: 12 }}>
          <EditorialButton fullWidth onPress={runDelete} disabled={!canDelete || busy}>
            {busy ? 'Deleting…' : 'Delete all data'}
          </EditorialButton>
          <EditorialButton variant="secondary" fullWidth onPress={() => router.back()}>
            Changed your mind? Go back.
          </EditorialButton>
        </View>
      </View>
    </ScrollView>
  );
}
