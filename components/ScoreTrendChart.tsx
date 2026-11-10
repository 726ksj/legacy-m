import { useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import { Text } from "./AppText";
import type { TrendPoint } from "../lib/trend";

const PLOT_H = 168;
const PAD_TOP = 22;
const PAD_BOTTOM = 26;
const SVG_H = PLOT_H + PAD_TOP + PAD_BOTTOM;
const MIN_SLOT = 46; // 주차 한 칸의 최소 너비(주차가 많으면 가로 스크롤)
const Y_TICKS = [0, 25, 50, 75, 100];

// 주차별 성적 꺾은선 그래프. x축은 주차, y축은 0~100점이다.
//  - 점수가 없는 주차는 선이 끊긴다.
//  - 점을 누르면(주차 칸 어디든) onSelect(week)로 그 주차를 고른다.
//  - 지각·기한 초과로 본 주차의 점에는 주황 표시가 붙는다.
export default function ScoreTrendChart({
  points,
  selectedWeek,
  onSelect,
  color,
  accent,
}: {
  points: TrendPoint[];
  selectedWeek: number;
  onSelect: (week: number) => void;
  color: string;
  accent: string;
}) {
  const [width, setWidth] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const n = Math.max(points.length, 1);
  const slot = Math.max(MIN_SLOT, width > 0 ? width / n : MIN_SLOT);
  const contentW = slot * n;
  const y = (v: number) => PAD_TOP + (1 - v / 100) * PLOT_H;
  const x = (i: number) => slot * (i + 0.5);

  // 선택한 주차가 화면 가운데쯤 오도록 가로 스크롤을 맞춘다(주차가 많을 때만 의미가 있다).
  useEffect(() => {
    if (width === 0 || contentW <= width) return;
    const target = x(selectedWeek - 1) - width / 2;
    scrollRef.current?.scrollTo({ x: Math.max(0, target), animated: true });
  }, [selectedWeek, width, contentW]); // eslint-disable-line react-hooks/exhaustive-deps

  // 점수가 이어지는 구간마다 선과 아래 면을 그린다.
  const segments: { i: number; score: number }[][] = [];
  let current: { i: number; score: number }[] = [];
  points.forEach((p, i) => {
    if (p.score === null) {
      if (current.length > 0) segments.push(current);
      current = [];
    } else {
      current.push({ i, score: p.score });
    }
  });
  if (current.length > 0) segments.push(current);

  return (
    <View className="flex-row" onLayout={(e) => setWidth(e.nativeEvent.layout.width - 34)}>
      {/* y축 눈금 이름은 스크롤 밖에 고정한다. */}
      <View style={{ width: 34, height: SVG_H }}>
        {Y_TICKS.map((v) => (
          <Text
            key={v}
            className="absolute right-1.5 text-[11px] text-ink-soft"
            style={{ top: y(v) - 8 }}
          >
            {v}
          </Text>
        ))}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
      >
        <Svg width={contentW} height={SVG_H}>
          {Y_TICKS.map((v) => (
            <Line
              key={v}
              x1={0}
              x2={contentW}
              y1={y(v)}
              y2={y(v)}
              stroke="#f6dde5"
              strokeWidth={1}
            />
          ))}

          {/* 선택한 주차를 옅게 칠한다. */}
          {selectedWeek >= 1 && selectedWeek <= n && (
            <Rect
              x={slot * (selectedWeek - 1)}
              y={PAD_TOP - 6}
              width={slot}
              height={PLOT_H + 12}
              rx={10}
              fill={accent}
              opacity={0.55}
            />
          )}

          {segments.map((seg, k) => {
            const line = seg
              .map((p, idx) => `${idx === 0 ? "M" : "L"} ${x(p.i)} ${y(p.score)}`)
              .join(" ");
            const area =
              seg.length > 1
                ? `${line} L ${x(seg[seg.length - 1].i)} ${y(0)} L ${x(seg[0].i)} ${y(0)} Z`
                : null;
            return (
              <G key={k}>
                {area && <Path d={area} fill={color} opacity={0.1} />}
                {seg.length > 1 && (
                  <Path
                    d={line}
                    stroke={color}
                    strokeWidth={2.5}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    fill="none"
                  />
                )}
              </G>
            );
          })}

          {points.map((p, i) => (
            <G key={p.week}>
              {p.score !== null && (
                <>
                  <Circle
                    cx={x(i)}
                    cy={y(p.score)}
                    r={p.week === selectedWeek ? 7 : 5}
                    fill={p.week === selectedWeek ? "#ffffff" : color}
                    stroke={color}
                    strokeWidth={p.week === selectedWeek ? 3 : 2}
                  />
                  {p.late && (
                    <Circle cx={x(i) + 7} cy={y(p.score) - 7} r={3.5} fill="#f97316" />
                  )}
                  <SvgText
                    x={x(i)}
                    y={y(p.score) - 12}
                    fontSize={11}
                    fontWeight="bold"
                    fill="#3a1b25"
                    textAnchor="middle"
                  >
                    {p.score}
                  </SvgText>
                </>
              )}
              <SvgText
                x={x(i)}
                y={SVG_H - 8}
                fontSize={11}
                fontWeight={p.week === selectedWeek ? "bold" : "normal"}
                fill={p.week === selectedWeek ? color : "#8c6b76"}
                textAnchor="middle"
              >
                {`${p.week}주`}
              </SvgText>
              {/* 주차 칸 전체가 눌리는 영역이다. */}
              <Rect
                x={slot * i}
                y={0}
                width={slot}
                height={SVG_H}
                fill="transparent"
                onPress={() => onSelect(p.week)}
              />
            </G>
          ))}
        </Svg>
      </ScrollView>
    </View>
  );
}
