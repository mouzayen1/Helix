// Bottom-sheet modal for inspecting / editing / deleting a single dose
// — editorial restyle. Originally lived inline in app/(tabs)/index.tsx;
// extracted so the new /dose-history screen can reuse the same UX
// without duplicating the plumbing.
//
// Behavior:
//   - "Log another" closes and routes to /log-dose with peptide + amount
//     pre-filled.
//   - "Delete dose" removes the row and restores remaining_mg if the
//     dose was tied to a vial.
//   - Backdrop tap or "Cancel" dismisses without changes.
//
// Caller tracks which Dose (or null) is currently shown.
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { EditorialButton } from './editorial/EditorialButton';
import { EditorialSheet, SheetHeader } from './editorial/EditorialSheet';
import { useEditorialTheme } from '../lib/design/theme';
import { deleteDose, type Dose } from '../lib/db';
import { findPeptide } from '../lib/peptides';

type Props = {
  dose: Dose | null;
  onClose: () => void;
  // Fired after a successful delete so the caller can refresh its list.
  onDeleted?: () => void;
};

export function DoseDetailSheet({ dose, onClose, onDeleted }: Props) {
  const ed = useEditorialTheme();
  const router = useRouter();

  const handleDelete = async () => {
    if (!dose) return;
    await deleteDose(dose.id);
    onClose();
    onDeleted?.();
  };

  const peptide = dose ? findPeptide(dose.peptide_id) : null;

  return (
    <EditorialSheet visible={!!dose} onClose={onClose}>
      {dose ? (
        <>
          <SheetHeader
            title={peptide?.name ?? dose.peptide_id}
            detail={`${dose.amount_mcg} mcg · ${dose.route}${dose.site ? ` · ${dose.site}` : ''} · ${new Date(
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
              Log another
            </EditorialButton>
            <EditorialButton variant="secondary" fullWidth onPress={handleDelete}>
              Delete dose (restores vial)
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
