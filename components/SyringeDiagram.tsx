// True-to-scale insulin syringe with U-100 unit markings.
// Auto-picks the smallest size that fits the dose (0.3 mL = 30u,
// 0.5 mL = 50u, 1.0 mL = 100u). Manual override via size chips.
//
// Replaces the original 11-tick bar in app/reconstitute.tsx, which carried
// no unit numbers, no labeled syringe size, and no calibrated tick density.

import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
import { font, radius, space } from '../theme/tokens';

export type SyringeSize = 0.3 | 0.5 | 1.0;

const SIZE_MAX_UNITS: Record<string, number> = { '0.3': 30, '0.5': 50, '1.0': 100 };
const SIZE_LABEL: Record<string, string> = { '0.3': '0.3 mL', '0.5': '0.5 mL', '1.0': '1.0 mL' };

function autoPickSize(units: number): SyringeSize {
  if (units <= 30) return 0.3;
  if (units <= 50) return 0.5;
  return 1.0;
}

export function SyringeDiagram({ unitsToDraw }: { unitsToDraw: number }) {
  const { t } = useTheme();
  const safeUnits = isFinite(unitsToDraw) && unitsToDraw > 0 ? unitsToDraw : 0;
  const [override, setOverride] = useState<SyringeSize | null>(null);
  const auto = autoPickSize(safeUnits);
  const size = override ?? auto;
  const maxUnits = SIZE_MAX_UNITS[String(size)];

  const overflows = safeUnits > maxUnits;
  const fillUnits = Math.min(safeUnits, maxUnits);

  // Tick spacing per size — every 1u short, every 5u medium-with-label,
  // every 10u long-with-bigger-label. 100u syringe gets a slightly sparser
  // 1u tick density (only every 2u) to avoid visual mush.
  const minorEvery = size === 1.0 ? 2 : 1;
  const labelEvery = size === 1.0 ? 10 : 5;
  const boldEvery = size === 1.0 ? 20 : 10;

  // Geometry: total SVG width 320px. Reserve 8px left needle, 248px barrel,
  // 64px right (plunger collar + thumb-rest). Numbers are mapped along the
  // 248-px barrel.
  const W = 320;
  const H = 96;
  const barrelX = 24;
  const barrelW = 240;
  const barrelY = 38;
  const barrelH = 28;
  const unitToX = (u: number) => barrelX + (u / maxUnits) * barrelW;

  const ticks = useMemo(() => {
    const toX = (u: number) => barrelX + (u / maxUnits) * barrelW;
    const out: { u: number; x: number; major: boolean; bold: boolean; label?: string }[] = [];
    for (let u = 0; u <= maxUnits; u += minorEvery) {
      const major = u % labelEvery === 0;
      const bold = u % boldEvery === 0;
      const x = toX(u);
      out.push({ u, x, major, bold, label: major ? String(u) : undefined });
    }
    return out;
  }, [maxUnits, minorEvery, labelEvery, boldEvery]);

  const drawX = unitToX(fillUnits);

  return (
    <View>
      {/* Size badge + override chips */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <Text
          style={{
            fontSize: 11,
            color: t.ink3,
            fontFamily: font.sansSemi,
            letterSpacing: 1.1,
            textTransform: 'uppercase',
          }}
        >
          Syringe · {SIZE_LABEL[String(size)]} · U-100
        </Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {([0.3, 0.5, 1.0] as SyringeSize[]).map((s) => {
            const active = s === size;
            const isAuto = override === null && s === auto;
            return (
              <Pressable
                key={s}
                onPress={() => setOverride(active ? null : s)}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: radius.pill,
                  backgroundColor: active ? t.ink : t.surface,
                  borderWidth: 1,
                  borderColor: active ? t.ink : t.line,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontFamily: font.monoSemi,
                    color: active ? t.bg : t.ink2,
                  }}
                >
                  {s.toFixed(1)}{isAuto ? '★' : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* The barrel */}
      <View
        style={{
          backgroundColor: t.surface,
          borderRadius: radius.md,
          paddingVertical: space.md,
          paddingHorizontal: space.sm,
          borderWidth: 1,
          borderColor: t.line,
        }}
      >
        <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
          {/* Needle */}
          <Line x1={0} y1={barrelY + barrelH / 2} x2={barrelX} y2={barrelY + barrelH / 2} stroke={t.ink3} strokeWidth={1.5} />
          {/* Hub */}
          <Path
            d={`M ${barrelX - 6} ${barrelY + 6} L ${barrelX} ${barrelY} L ${barrelX} ${barrelY + barrelH} L ${barrelX - 6} ${barrelY + barrelH - 6} Z`}
            fill={t.ink3}
          />
          {/* Barrel outline */}
          <Rect
            x={barrelX}
            y={barrelY}
            width={barrelW}
            height={barrelH}
            rx={2}
            fill="none"
            stroke={t.ink2}
            strokeWidth={1.5}
          />
          {/* Liquid fill */}
          {fillUnits > 0 ? (
            <Rect
              x={barrelX + 1}
              y={barrelY + 1.5}
              width={Math.max(0, drawX - barrelX - 1)}
              height={barrelH - 3}
              fill={t.accent}
              opacity={0.85}
            />
          ) : null}
          {/* Plunger collar */}
          <Rect x={drawX} y={barrelY - 2} width={4} height={barrelH + 4} fill={t.ink} />
          {/* Plunger shaft */}
          <Rect x={barrelX + barrelW} y={barrelY + 4} width={48} height={barrelH - 8} fill={t.surfaceAlt} stroke={t.ink3} strokeWidth={1} />
          {/* Thumb rest */}
          <Rect x={barrelX + barrelW + 48} y={barrelY - 4} width={8} height={barrelH + 8} rx={1.5} fill={t.ink3} />

          {/* Tick marks */}
          <G>
            {ticks.map((tick) => {
              const len = tick.bold ? 12 : tick.major ? 8 : 4;
              return (
                <Line
                  key={tick.u}
                  x1={tick.x}
                  y1={barrelY - len}
                  x2={tick.x}
                  y2={barrelY}
                  stroke={tick.bold ? t.ink : t.ink3}
                  strokeWidth={tick.bold ? 1.4 : 1}
                />
              );
            })}
          </G>

          {/* Unit numeric labels */}
          <G>
            {ticks
              .filter((tick) => tick.label !== undefined && tick.bold)
              .map((tick) => (
                <SvgText
                  key={`l-${tick.u}`}
                  x={tick.x}
                  y={barrelY - 16}
                  fontSize={9}
                  fontFamily={font.monoSemi}
                  fill={t.ink2}
                  textAnchor="middle"
                >
                  {tick.label}
                </SvgText>
              ))}
          </G>

          {/* "Draw to N units" caption + arrow under the plunger */}
          {fillUnits > 0 ? (
            <G>
              <Line
                x1={drawX}
                y1={barrelY + barrelH}
                x2={drawX}
                y2={barrelY + barrelH + 10}
                stroke={t.accent}
                strokeWidth={1.5}
              />
              <SvgText
                x={drawX}
                y={barrelY + barrelH + 22}
                fontSize={11}
                fontFamily={font.monoSemi}
                fill={t.accent}
                textAnchor="middle"
              >
                {`Draw to ${safeUnits.toFixed(1)} u`}
              </SvgText>
            </G>
          ) : null}
        </Svg>
      </View>

      {/* Helper line + overflow warning */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
        <Text style={{ fontSize: 11, color: t.ink3, fontFamily: font.mono }}>
          1 u = 0.01 mL
        </Text>
        {overflows ? (
          <Text style={{ fontSize: 11, color: t.danger, fontFamily: font.sansSemi }}>
            Won&apos;t fit — switch to {safeUnits > 50 ? '1.0' : '0.5'} mL
          </Text>
        ) : null}
      </View>
    </View>
  );
}
