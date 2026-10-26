import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./AppText";
import ScreenHeader from "./ScreenHeader";
import { supabase } from "../lib/supabase";
import { categoryColors, colors } from "../lib/theme";
import { KIND_TITLES } from "../lib/study";
import { fetchTextMemorize, type TextMemorizeSet } from "../lib/memorize";
import type { TestKind } from "../lib/weekly";

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
  const isFirst = index === 0;
  const isLast = index === cards.length - 1;
  const finish = () => (router.canGoBack() ? router.back() : router.replace(`/learn/${kind}`));

  return (
    <View className="flex-1 bg-blush">
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
          >
            <ScrollView contentContainerClassName="gap-3 px-5 py-6">
              <View
                className="self-start rounded-full px-3 py-1"
                style={{ backgroundColor: palette.accent }}
              >
                <Text className="text-sm font-bold" style={{ color: palette.fg }}>
                  {card.badge}
                </Text>
              </View>
              {card.blocks.map((block) => (
                <View
                  key={block.label}
                  className="rounded-2xl bg-white px-4 py-3.5"
                >
                  <Text className="text-sm font-bold" style={{ color: palette.fg }}>
                    {block.label}
                  </Text>
                  <Text
                    className={`mt-1 text-ink ${
                      block.emphasis ? "text-lg leading-7 font-bold" : "text-base leading-6"
                    }`}
                  >
                    {block.text}
                  </Text>
                </View>
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
