// Export — editorial rebuild.
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EditorialButton } from '../../components/editorial/EditorialButton';
import { EditorialHeadline } from '../../components/editorial/EditorialHeadline';
import { useEditorialTheme } from '../../lib/design/theme';
import { exportAllData } from '../../lib/db';

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
  const ed = useEditorialTheme();
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
      style={{ flex: 1, backgroundColor: ed.colors.bg }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 64 }}
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
            color: ed.colors.ink3,
            textTransform: 'uppercase',
            marginBottom: 14,
          }}
        >
          Export
        </Text>
        <EditorialHeadline size="title1">{`Your data, *your* file.`}</EditorialHeadline>
        <Text
          style={{
            marginTop: 14,
            fontFamily: ed.typography.bodyMd.fontFamily,
            fontSize: 15,
            lineHeight: 23,
            color: ed.colors.ink2,
          }}
        >
          Save all your doses, vials, cycles, stacks, journal entries, and metrics as a single
          file. Works offline — no account required.
        </Text>

        <View style={{ marginTop: 32, gap: 12 }}>
          <EditorialButton fullWidth disabled={busy} onPress={() => run('json')}>
            {busy ? 'Preparing…' : 'Export as JSON'}
          </EditorialButton>
          <EditorialButton variant="secondary" fullWidth disabled={busy} onPress={() => run('csv')}>
            {busy ? 'Preparing…' : 'Export as CSV'}
          </EditorialButton>
        </View>

        {status ? (
          <Text
            style={{
              marginTop: 20,
              fontFamily: ed.typography.dataMd.fontFamily,
              fontSize: ed.typography.dataMd.fontSize,
              color: ed.colors.ink3,
              lineHeight: 18,
            }}
          >
            {status}
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );
}
