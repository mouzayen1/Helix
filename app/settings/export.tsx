// Export — write JSON + CSV to device docs and share. Spec v2.0 §15.
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconChevronLeft } from '../../components/Icons';
import { exportAllData } from '../../lib/db';
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
        return csvCell(v);
      })
      .join(',')
  );
  return [header, ...lines].join('\n');
}

function csvCell(v: unknown): string {
  const raw = typeof v === 'string' ? v : JSON.stringify(v);
  const s = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return '"' + s.replace(/"/g, '""') + '"';
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
      const data = await exportAllData();
      const tableCounts: Record<string, number> = {};
      let totalRecords = 0;
      for (const [name, v] of Object.entries(data)) {
        if (Array.isArray(v)) {
          tableCounts[name] = v.length;
          totalRecords += v.length;
        }
      }
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const dir = FileSystem.documentDirectory ?? '';
      if (format === 'json') {
        const path = `${dir}helix-export-${ts}.json`;
        await FileSystem.writeAsStringAsync(path, JSON.stringify(data, null, 2));
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path);
        setStatus(
          `Exported ${totalRecords} records · schema v${data.schema_version} · ${path
            .split('/')
            .pop()}`
        );
      } else {
        // zip-style: concatenate per-table CSV sections with table headers.
        // (No zip lib in Expo by default; a single concatenated file keeps
        // the export path simple while still being parseable.)
        const sections: string[] = [];
        const tables: [string, unknown][] = [
          ['cycles', data.cycles],
          ['doses', data.doses],
          ['vials', data.vials],
          ['stacks', data.stacks],
          ['metrics', data.metrics],
          ['journal', data.journal],
          ['dose_skips', data.dose_skips],
          ['saved_peptides', data.saved_peptides],
        ];
        for (const [name, rows] of tables) {
          sections.push(`# ${name}`);
          if (Array.isArray(rows) && rows.length > 0) {
            const isObj = typeof rows[0] === 'object' && rows[0] !== null;
            sections.push(
              isObj
                ? toCsv(rows as Record<string, unknown>[])
                : `value\n${(rows as unknown[]).map((v) => csvCell(String(v))).join('\n')}`
            );
          } else {
            sections.push('(empty)');
          }
          sections.push('');
        }
        sections.push(`# meta`);
        sections.push(`exported_at,schema_version`);
        sections.push(`"${data.exported_at}",${data.schema_version}`);
        const path = `${dir}helix-export-${ts}.csv`;
        await FileSystem.writeAsStringAsync(path, sections.join('\n'));
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path);
        setStatus(
          `Exported ${totalRecords} records across ${Object.keys(tableCounts).length} tables · ${path
            .split('/')
            .pop()}`
        );
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
          accessibilityRole="button"
          accessibilityLabel="Export as JSON"
          style={{
            marginTop: space.xl,
            padding: space.lg,
            backgroundColor: busy ? t.surfaceAlt : t.ink,
            borderRadius: radius.md,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: busy ? t.ink3 : t.bg, fontSize: 15, fontFamily: font.sansSemi }}>
            {busy ? 'Preparing export…' : 'Export as JSON'}
          </Text>
        </Pressable>
        <Pressable
          disabled={busy}
          onPress={() => run('csv')}
          accessibilityRole="button"
          accessibilityLabel="Export as CSV"
          style={{
            marginTop: space.sm,
            padding: space.lg,
            borderWidth: 1,
            borderColor: t.lineStrong,
            borderRadius: radius.md,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: busy ? t.ink3 : t.ink, fontSize: 15, fontFamily: font.sansSemi }}>
            {busy ? 'Preparing export…' : 'Export as CSV'}
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
