import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./AppText";
import ScreenHeader from "./ScreenHeader";
import { supabase } from "../lib/supabase";
import { categoryColors, colors } from "../lib/theme";
import { KIND_TITLES } from "../lib/study";
import { fetchTextMemorize, type MemorizeBlock, type TextMemorizeSet } from "../lib/memorize";
import { useMemorizeFinish } from "./useMemorizeFinish";
import type { TestKind } from "../lib/weekly";

const BOX_PAD_Y = 14; // 칸 안쪽 위아래 여백(py-3.5)
const LABEL_H = 24; // 칸 이름 줄 높이
const MIN_BOX = 84; // 칸이 이보다 작아지지 않게 한다
const MIN_FONT = 13; // 글자를 줄여도 이 크기까지만 줄인다
const GAP = 12;
const BADGE_H = 28;
const CARD_PAD_Y = 16;

// 카드 안의 남는 높이를 칸마다 나눈다. 세트 전체에서 가장 긴 글(weights)에 비례해 나누므로
// 같은 세트의 모든 카드에서 칸 크기가 같고, 글이 긴 칸이 더 큰 몫을 받는다.
function splitHeights(areaH: number, weights: number[]): number[] {
  const n = weights.length;
  const avail = areaH - CARD_PAD_Y * 2 - BADGE_H - n * GAP;
  if (avail <= 0) return weights.map(() => MIN_BOX);
  const w = weights.map((x) => x + 40);
  const total = w.reduce((a, b) => a + b, 0);
  let heights = w.map((x) => (avail * x) / total);
  // 너무 작아진 칸은 최소 높이로 올리고, 모자란 만큼을 큰 칸들에서 비례해 덜어 낸다.
  const small = heights.map((h) => h < MIN_BOX);
  if (small.some(Boolean)) {
    const fixed = small.filter(Boolean).length * MIN_BOX;
    const restW = w.filter((_, i) => !small[i]).reduce((a, b) => a + b, 0);
    heights = heights.map((h, i) =>
      small[i] ? MIN_BOX : Math.max(MIN_BOX, ((avail - fixed) * w[i]) / (restW || 1)),
    );
  }
  return heights.map((h) => Math.floor(h));
}

// 한 칸: 정해진 높이 안에 글을 넣는다. 넘치면 글자를 한 단계씩 줄여 맞추고(최소 MIN_FONT),
// 그래도 넘치면 칸 안에서 스크롤하며 아래에 "더 있음" 표시를 보여 준다.
function FitBlock({
  block,
  height,
  fg,
}: {
  block: MemorizeBlock;
  height: number;
  fg: string;
}) {
  const base = block.emphasis ? 20 : 18;
  const [size, setSize] = useState(base);
  const [overflow, setOverflow] = useState(false);
  const room = Math.max(0, height - BOX_PAD_Y * 2 - LABEL_H);

  // 칸 높이가 바뀌면(화면 회전·크기 변경) 처음 크기에서 다시 맞춘다.
  useEffect(() => {
    setSize(base);
    setOverflow(false);
  }, [height, base]);

  return (
    <View
      className="rounded-2xl bg-white px-4"
      style={{ height, paddingVertical: BOX_PAD_Y }}
    >
      <Text className="text-sm font-bold" style={{ color: fg }}>
        {block.label}
      </Text>
      <ScrollView
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        style={{ height: room, marginTop: 4 }}
        onContentSizeChange={(_, contentH) => {
          if (contentH > room + 1) {
            if (size > MIN_FONT) setSize(size - 1);
            else setOverflow(true);
          } else {
            setOverflow(false);
          }
        }}
      >
        <Text
          className={`text-ink ${block.emphasis ? "font-bold" : ""}`}
          style={{ fontSize: size, lineHeight: Math.round(size * 1.45) }}
        >
          {block.text}
        </Text>
      </ScrollView>
      {overflow && (
        <View pointerEvents="none" className="absolute bottom-1.5 right-3">
          <Ionicons name="chevron-down-circle" size={20} color={fg} />
        </View>
      )}
    </View>
  );
}

// 어순 배열·순서 배열·문장 배열 암기: 문제 하나를 카드 한 장에 정답 순서대로 보여 주고
// 이전/다음으로 넘긴다. 카드 높이와 버튼 위치는 내용 길이와 관계없이 고정이다.
export default function TextMemorize({
  kind,
  setId,
}: {
  kind: Exclude<TestKind, "vocab">;
  setId: string;
}) {
  const palette = categoryColors[kind];
  const [data, setData] = useState<TextMemorizeSet | null>(null);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [areaH, setAreaH] = useState(0);

  const load = useCallback(async () => {
    setError(null);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    try {
      setData(await fetchTextMemorize(kind, setId));
    } catch {
      setError("암기 내용을 불러오지 못했어요.");
    }
  }, [kind, setId]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const cards = data?.cards ?? [];
  const card = cards[index];
  // 칸마다 세트 전체에서 가장 긴 글의 길이(칸 높이 배분의 기준).
  const weights = useMemo(() => {
    const n = Math.max(0, ...cards.map((c) => c.blocks.length));
    return Array.from({ length: n }, (_, i) =>
      Math.max(0, ...cards.map((c) => c.blocks[i]?.text.length ?? 0)),
    );
  }, [cards]);
  const heights = useMemo(() => splitHeights(areaH, weights), [areaH, weights]);
  const isFirst = index === 0;
  const isLast = index === cards.length - 1;
  // 마지막 카드에서 완료하면 시험을 볼지 묻는다(예: 시험 화면, 아니오: 학습 목록).
  const { finish, finishPrompt } = useMemorizeFinish(kind, setId);

  return (
    <View className="flex-1 bg-blush">
      {finishPrompt}
      <ScreenHeader
        title={`${KIND_TITLES[kind]} 암기`}
        back
        right={
          cards.length > 0 ? (
            <View className="min-w-[72px] items-center rounded-full bg-white/25 px-2.5 py-1">
              <Text className="text-sm font-bold text-white">
                {index + 1} / {cards.length}
              </Text>
            </View>
          ) : undefined
        }
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : error || !card ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-base font-semibold text-red-500">
            {error ?? "등록된 문제가 없어요."}
          </Text>
        </View>
      ) : (
        <View className="flex-1 gap-4 px-6 pb-6 pt-5">
          <Text className="text-base font-bold text-ink-soft" numberOfLines={1}>
            {data?.title}
          </Text>

          <View className="h-2 rounded-full bg-white">
            <View
              className="h-2 rounded-full"
              style={{
                width: `${((index + 1) / cards.length) * 100}%`,
                backgroundColor: palette.fg,
              }}
            />
          </View>

          <View
            className="flex-1 overflow-hidden rounded-3xl"
            style={{
              backgroundColor: palette.bg,
              borderWidth: 1,
              borderColor: palette.border,
            }}
            onLayout={(e) => setAreaH(e.nativeEvent.layout.height)}
          >
            {/* 남는 높이를 칸마다 나눠 쓰고, 칸이 모자란 아주 작은 화면에서만 카드 전체가 스크롤된다. */}
            <ScrollView
              contentContainerStyle={{
                gap: GAP,
                paddingHorizontal: 20,
                paddingVertical: CARD_PAD_Y,
              }}
            >
              <View
                className="self-start rounded-full px-3 py-1"
                style={{ backgroundColor: palette.accent }}
              >
                <Text className="text-sm font-bold" style={{ color: palette.fg }}>
                  {card.badge}
                </Text>
              </View>
              {card.blocks.map((block, i) => (
                <FitBlock
                  key={`${index}:${block.label}`}
                  block={block}
                  height={heights[i] ?? MIN_BOX}
                  fg={palette.fg}
                />
              ))}
            </ScrollView>
          </View>

          <View className="flex-row gap-3">
            <Pressable
              onPress={() => setIndex(index - 1)}
              disabled={isFirst}
              style={{ opacity: isFirst ? 0.4 : 1 }}
              className="flex-1 flex-row items-center justify-center gap-1 rounded-2xl border border-line bg-white py-4"
            >
              <Ionicons name="chevron-back" size={20} color={colors.inkSoft} />
              <Text className="text-lg font-bold text-ink-soft">이전</Text>
            </Pressable>
            <Pressable
              onPress={() => (isLast ? finish() : setIndex(index + 1))}
              className="flex-1 flex-row items-center justify-center gap-1 rounded-2xl bg-brand py-4 shadow-md shadow-brand/40"
            >
              <Text className="text-lg font-bold text-white">
                {isLast ? "완료" : "다음"}
              </Text>
              {!isLast && <Ionicons name="chevron-forward" size={20} color="#ffffff" />}
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
