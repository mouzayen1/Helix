// Bottom-sheet modal for inspecting / editing / deleting a single dose.
// Originally lived inline in app/(tabs)/index.tsx; extracted so the new
// /dose-history screen can reuse the same edit/delete UX without
// duplicating the plumbing. Today and Dose History both render this with
// their own dose state + onChange handler.
//
// Behavior:
//   - "Log another" closes the sheet and routes to /log-dose with the
//     dose's peptide + amount pre-filled.
//   - "Delete dose" removes the row and (if the dose was tied to a vial)
//     restores the drawn mg back to remaining_mg via deleteDose() in
//     lib/db.ts.
//   - "Cancel" or backdrop tap dismisses without changes.
//
// Caller is responsible for tracking which Dose (or null) is currently
// shown — same pattern as React's controlled inputs.
import { useRouter } from 'expo-router';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { deleteDose, type Dose } from '../lib/db';
import { findPeptide } from '../lib/peptides';
import { useTheme } from '../theme/ThemeContext';
import { font, radius, space } from '../theme/tokens';

type Props = {
  dose: Dose | null;
  onClose: () => void;
  // Fired after a successful delete so the caller can refresh its list.
  onDeleted?: () => void;
};

export function DoseDetailSheet({ dose, onClose, onDeleted }: Props) {
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleDelete = async () => {
    if (!dose) return;
    await deleteDose(dose.id);
    onClose();
    onDeleted?.();
  };

  const peptide = dose ? findPeptide(dose.peptide_id) : null;

  return (
    <Modal visible={!!dose} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: t.surface,
            paddingTop: space.lg,
            paddingBottom: insets.bottom + space.lg,
            paddingHorizontal: space.xl,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            gap: 8,
          }}
        >
          {dose ? (
            <>
              <Text style={{ fontSize: 17, fontFamily: font.sansSemi, color: t.ink }}>
                {peptide?.name ?? dose.peptide_id}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: t.ink3,
                  fontFamily: font.mono,
                  marginBottom: space.md,
                }}
              >
                {dose.amount_mcg} mcg · {dose.route}
                {dose.site ? ` · ${dose.site}` : ''} ·{' '}
                {new Date(dose.taken_at).toLocaleString()}
              </Text>
              {dose.note ? (
                <View
                  style={{
                    backgroundColor: t.surfaceAlt,
                    borderRadius: radius.md,
                    padding: space.md,
                    marginBottom: space.sm,
                  }}
                >
                  <Text style={{ fontSize: 13, color: t.ink2, lineHeight: 19 }}>{dose.note}</Text>
                </View>
              ) : null}
              <Pressable
                onPress={() => {
                  onClose();
                  router.push({
                    pathname: '/log-dose',
                    params: { peptideId: dose.peptide_id, prefillDoseMcg: dose.amount_mcg },
                  } as any);
                }}
                accessibilityRole="button"
                accessibilityLabel="Log another dose with the same peptide and amount"
                style={{
                  padding: space.md,
                  borderRadius: radius.md,
                  backgroundColor: t.ink,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: t.bg, fontSize: 14, fontFamily: font.sansSemi }}>
                  Log another
                </Text>
              </Pressable>
              <Pressable
                onPress={handleDelete}
                accessibilityRole="button"
                accessibilityLabel="Delete dose"
                style={{
                  padding: space.md,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: t.danger,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: t.danger, fontSize: 14, fontFamily: font.sansSemi }}>
                  Delete dose (restores vial)
                </Text>
              </Pressable>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={{ padding: space.md, alignItems: 'center' }}
              >
                <Text style={{ color: t.ink3, fontSize: 14 }}>Cancel</Text>
              </Pressable>
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
