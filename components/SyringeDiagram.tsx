// True-to-scale insulin syringe with U-100 unit markings — editorial
// retint. Auto-picks the smallest size that fits the dose
// (0.3 mL = 30u, 0.5 mL = 50u, 1.0 mL = 100u). Manual override via
// sharp-corner size chips.
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useEditorialTheme } from '../lib/design/theme';

export type SyringeSize = 0.3 | 0.5 | 1.0;

const SIZE_MAX_UNITS: Record<string, number> = { '0.3': 30, '0.5': 50, '1.0': 100 };
const SIZE_LABEL: Record<string, string> = { '0.3': '0.3 mL', '0.5': '0.5 mL', '1.0': '1.0 mL' };

function autoPickSize(units: number): SyringeSize {
  if (units <= 30) return 0.3;
  if (units <= 50) return 0.5;
  return 1.0;
}

export function SyringeDiagram({ unitsToDraw }: { unitsToDraw: number }) {
  const ed = useEditorialTheme();
  const safeUnits = isFinite(unitsToDraw) && unitsToDraw > 0 ? unitsToDraw : 0;
  const [override, setOverride] = useState<SyringeSize | null>(null);
  const auto = autoPickSize(safeUnits);
  const size = override ?? auto;
  const maxUnits = SIZE_MAX_UNITS[String(size)];

  const overflows = safeUnits > maxUnits;
  const fillUnits = Math.min(safeUnits, maxUnits);

  const minorEvery = size === 1.0 ? 2 : 1;
  const labelEvery = size === 1.0 ? 10 : 5;
  const boldEvery = size === 1.0 ? 20 : 10;

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
          marginBottom: 12,
        }}
      >
        <Text
          style={{
            fontFamily: ed.typography.labelSm.fontFamily,
            fontSize: ed.typography.labelSm.fontSize,
            letterSpacing: ed.typography.labelSm.letterSpacing,
            color: ed.colors.ink3,
            textTransform: 'uppercase',
          }}
        >
          {SIZE_LABEL[String(size)]} · U-100
        </Text>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {([0.3, 0.5, 1.0] as SyringeSize[]).map((s) => {
            const active = s === size;
            const isAuto = override === null && s === auto;
            return (
              <Pressable
                key={s}
                onPress={() => setOverride(active ? null : s)}
                style={{
                  paddingVertical: 4,
                  paddingHorizontal: 8,
                  backgroundColor: active ? ed.colors.ink1 : 'transparent',
                  borderWidth: 1,
                  borderColor: active ? ed.colors.ink1 : ed.colors.lineStrong,
                }}
              >
                <Text
                  style={{
                    fontFamily: ed.typography.labelSm.fontFamily,
                    fontSize: ed.typography.labelSm.fontSize,
                    letterSpacing: ed.typography.labelSm.letterSpacing,
                    color: active ? ed.colors.bg : ed.colors.ink2,
                    textTransform: 'uppercase',
                  }}
                >
                  {s.toFixed(1)}
                  {isAuto ? '★' : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* The barrel */}
      <View
        style={{
          paddingVertical: 16,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: ed.colors.line,
        }}
      >
        <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
          {/* Needle */}
          <Line
            x1={0}
            y1={barrelY + barrelH / 2}
            x2={barrelX}
            y2={barrelY + barrelH / 2}
            stroke={ed.colors.ink4}
            strokeWidth={1}
          />
          {/* Hub */}
          <Path
            d={`M ${barrelX - 6} ${barrelY + 6} L ${barrelX} ${barrelY} L ${barrelX} ${barrelY + barrelH} L ${barrelX - 6} ${barrelY + barrelH - 6} Z`}
            fill={ed.colors.ink4}
          />
          {/* Barrel outline */}
          <Rect
            x={barrelX}
            y={barrelY}
            width={barrelW}
            height={barrelH}
            fill="none"
            stroke={ed.colors.lineStrong}
            strokeWidth={1}
          />
          {/* Liquid fill */}
          {fillUnits > 0 ? (
            <Rect
              x={barrelX + 1}
              y={barrelY + 1.5}
              width={Math.max(0, drawX - barrelX - 1)}
              height={barrelH - 3}
              fill={ed.colors.brand}
              opacity={0.85}
            />
          ) : null}
          {/* Plunger collar */}
          <Rect x={drawX} y={barrelY - 2} width={3} height={barrelH + 4} fill={ed.colors.ink1} />
          {/* Plunger shaft */}
          <Rect
            x={barrelX + barrelW}
            y={barrelY + 6}
            width={48}
            height={barrelH - 12}
            fill="none"
            stroke={ed.colors.ink4}
            strokeWidth={1}
          />
          {/* Thumb rest */}
          <Rect
            x={barrelX + barrelW + 48}
            y={barrelY - 4}
            width={6}
            height={barrelH + 8}
            fill={ed.colors.ink4}
          />

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
                  stroke={tick.bold ? ed.colors.ink2 : ed.colors.ink4}
                  strokeWidth={1}
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
                  fontFamily={ed.typography.dataMd.fontFamily}
                  fill={ed.colors.ink3}
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
                stroke={ed.colors.brand}
                strokeWidth={1}
              />
              <SvgText
                x={drawX}
                y={barrelY + barrelH + 22}
                fontSize={10}
                fontFamily={ed.typography.dataMd.fontFamily}
                fill={ed.colors.brand}
                textAnchor="middle"
              >
                {`Draw to ${safeUnits.toFixed(1)} u`}
              </SvgText>
            </G>
          ) : null}
        </Svg>
      </View>

      {/* Helper line + overflow warning */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 8,
        }}
      >
        <Text
          style={{
            fontFamily: ed.typography.labelSm.fontFamily,
            fontSize: ed.typography.labelSm.fontSize,
            letterSpacing: ed.typography.labelSm.letterSpacing,
            color: ed.colors.ink3,
            textTransform: 'uppercase',
          }}
        >
          1 u = 0.01 mL
        </Text>
        {overflows ? (
          <Text
            style={{
              fontFamily: ed.typography.labelSm.fontFamily,
              fontSize: ed.typography.labelSm.fontSize,
              letterSpacing: ed.typography.labelSm.letterSpacing,
              color: ed.colors.stateWarn,
              textTransform: 'uppercase',
            }}
          >
            Won't fit — switch to {safeUnits > 50 ? '1.0' : '0.5'} mL
          </Text>
        ) : null}
      </View>
    </View>
  );
}
