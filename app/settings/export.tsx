// Export — write JSON + CSV to device docs and share. Spec v2.0 §15.
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconChevronLeft } from '../../components/Icons';
import { exportAll } from '../../lib/db';
import { useTheme } from '../../theme/ThemeContext';
import { font, radius, space } from '../../theme/tokens';

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const header = keys.join(',');
  const lines = rows.map((r) =>
    keys
      .map((k) => {
        const v = r[k];
        if (v == null) return '';
        const s = typeof v === 'string' ? v : JSON.stringify(v);
        return '"' + s.replace(/"/g, '""') + '"';
      })
      .join(',')
  );
  return [header, ...lines].join('\n');
}

export default function ExportScreen() {
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const run = async (format: 'json' | 'csv') => {
    setBusy(true);
    setStatus(null);
    try {
      const data = await exportAll();
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const dir = FileSystem.documentDirectory ?? '';
      if (format === 'json') {
        const path = `${dir}helix-export-${ts}.json`;
        await FileSystem.writeAsStringAsync(path, JSON.stringify(data, null, 2));
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path);
        setStatus(`Saved to ${path.split('/').pop()}`);
      } else {
        // zip-style: concatenate per-table CSV sections
        const sections: string[] = [];
        for (const [name, rows] of Object.entries(data)) {
          if (Array.isArray(rows)) {
            sections.push(`# ${name}\n${toCsv(rows as Record<string, unknown>[])}\n`);
          } else if (rows && typeof rows === 'object') {
            sections.push(`# ${name}\n${toCsv([rows as Record<string, unknown>])}\n`);
          }
        }
        const path = `${dir}helix-export-${ts}.csv`;
        await FileSystem.writeAsStringAsync(path, sections.join('\n'));
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path);
        setStatus(`Saved to ${path.split('/').pop()}`);
      }
    } catch (err) {
      setStatus(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    setBusy(false);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: insets.top + space.sm,
          paddingBottom: space.md,
          paddingHorizontal: space.xl,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <IconChevronLeft size={18} color={t.ink2} />
        </Pressable>
      </View>
      <View style={{ paddingHorizontal: space.xl }}>
        <Text style={{ fontSize: 28, fontFamily: font.sansBold, color: t.ink, letterSpacing: -0.6 }}>
          Export data
        </Text>
        <Text style={{ color: t.ink2, fontSize: 14, lineHeight: 21, marginTop: 6 }}>
          Save all your doses, vials, cycles, stacks, journal entries, and metrics as a single
          file. Works offline — no account required.
        </Text>

        <Pressable
          disabled={busy}
          onPress={() => run('json')}
          style={{
            marginTop: space.xl,
            padding: space.lg,
            backgroundColor: t.ink,
            borderRadius: radius.md,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: t.bg, fontSize: 15, fontFamily: font.sansSemi }}>
            Export JSON
          </Text>
        </Pressable>
        <Pressable
          disabled={busy}
          onPress={() => run('csv')}
          style={{
            marginTop: space.sm,
            padding: space.lg,
            borderWidth: 1,
            borderColor: t.lineStrong,
            borderRadius: radius.md,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: t.ink, fontSize: 15, fontFamily: font.sansSemi }}>
            Export CSV
          </Text>
        </Pressable>

        {status ? (
          <Text style={{ marginTop: space.md, color: t.ink3, fontSize: 12, fontFamily: font.mono }}>
            {status}
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );
}
