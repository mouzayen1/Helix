// Bottom-sheet modal for inspecting / editing / deleting a single dose
// — editorial restyle. Originally lived inline in app/(tabs)/index.tsx;
// extracted so the new /dose-history screen can reuse the same UX
// without duplicating the plumbing.
//
// Behavior:
//   - "Log another" closes and routes to /log-dose with peptide + amount
//     pre-filled (creates a new dose entry).
//   - "Edit this dose" closes and routes to /log-dose?editId=<id>, where
//     the form loads the existing dose and saves through updateDose().
//   - "Delete dose" prompts a destructive Alert.alert confirm; on
//     confirm, removes the row and restores remaining_mg if the dose
//     was tied to a vial.
//   - Backdrop tap or "Cancel" dismisses without changes.
//
// Caller tracks which Dose (or null) is currently shown.
import { useRouter } from 'expo-router';
import { Alert, Text, View } from 'react-native';
import { EditorialButton } from './editorial/EditorialButton';
import { EditorialSheet, SheetHeader } from './editorial/EditorialSheet';
import { useEditorialTheme } from '../lib/design/theme';
import { deleteDose, type Dose } from '../lib/db';
import { findPeptide } from '../lib/peptides';
import { useDoseUnitPref } from '../lib/profile-context';
import { formatDoseLabel } from '../lib/dose-format';

type Props = {
  dose: Dose | null;
  onClose: () => void;
  // Fired after a successful delete so the caller can refresh its list.
  onDeleted?: () => void;
};

export function DoseDetailSheet({ dose, onClose, onDeleted }: Props) {
  const ed = useEditorialTheme();
  const router = useRouter();
  const { pref: doseUnitPref } = useDoseUnitPref();

  const handleDelete = () => {
    if (!dose) return;
    // Two-tap destructive pattern. Native Alert renders the second
    // button with destructive styling (red on iOS, prominent on
    // Android) so accidental taps on Delete-then-OK are unlikely.
    // The body line names the data side-effect ("vial's remaining
    // volume will be restored") so users aren't guessing.
    Alert.alert(
      'Delete this dose?',
      "This action can't be undone. The vial's remaining volume will be restored.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteDose(dose.id);
            onClose();
            onDeleted?.();
          },
        },
      ],
    );
  };

  const peptide = dose ? findPeptide(dose.peptide_id) : null;

  return (
    <EditorialSheet visible={!!dose} onClose={onClose}>
      {dose ? (
        <>
          <SheetHeader
            title={peptide?.name ?? dose.peptide_id}
            detail={`${formatDoseLabel(dose.amount_mcg, doseUnitPref)} · ${dose.route}${dose.site ? ` · ${dose.site}` : ''} · ${new Date(
              dose.taken_at
            ).toLocaleString()}`}
          />
          {dose.note ? (
            <View
              style={{
                marginTop: 14,
                paddingVertical: 12,
                borderTopWidth: 1,
                borderBottomWidth: 1,
                borderColor: ed.colors.line,
              }}
            >
              <Text
                style={{
                  fontFamily: ed.fraunces('Fraunces_400Regular'),
                  fontSize: 15,
                  lineHeight: 23,
                  color: ed.colors.ink2,
                }}
              >
                {dose.note}
              </Text>
            </View>
          ) : null}
          <View style={{ marginTop: 18, gap: 12 }}>
            <EditorialButton
              fullWidth
              onPress={() => {
                onClose();
                router.push({
                  pathname: '/log-dose',
                  params: { peptideId: dose.peptide_id, prefillDoseMcg: dose.amount_mcg },
                } as any);
              }}
            >
              Log another dose
            </EditorialButton>
            <EditorialButton
              variant="secondary"
              fullWidth
              onPress={() => {
                onClose();
                router.push({
                  pathname: '/log-dose',
                  params: { editId: dose.id },
                } as any);
              }}
            >
              Edit this dose
            </EditorialButton>
            <EditorialButton variant="secondary" fullWidth onPress={handleDelete}>
              Delete dose
            </EditorialButton>
            <EditorialButton variant="secondary" fullWidth onPress={onClose}>
              Cancel
            </EditorialButton>
          </View>
        </>
      ) : null}
    </EditorialSheet>
  );
}
