import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { Text } from "../../components/AppText";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { categoryColors, colors } from "../../lib/theme";
import ScreenHeader from "../../components/ScreenHeader";

interface MemorizeWord {
  id: string;
  word: string;
  meaning: string;
  example: string | null;
  example_meaning: string | null;
}

// V01 단어 암기: 단어 · 뜻 · 예시 문장 · 예시 문장 뜻을 한 카드에 보여주고 이전/다음으로 넘긴다.
export default function MemorizeScreen() {
  const { setId } = useLocalSearchParams<{ setId: string }>();
  const [title, setTitle] = useState("");
  const [words, setWords] = useState<MemorizeWord[]>([]);
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

    const [{ data: set, error: setError_ }, { data: rows, error: wordsError }] =
      await Promise.all([
        supabase
          .from("vocab_sets")
          .select("title")
          .eq("id", setId)
          .maybeSingle(),
        supabase
          .from("vocab_words")
          .select("id, word, meaning, example, example_meaning")
          .eq("vocab_set_id", setId)
          .order("sort_order", { ascending: true })
          .returns<MemorizeWord[]>(),
      ]);

    if (setError_ || wordsError || !set) {
      setError("단어를 불러오지 못했어요.");
      return;
    }
    setTitle(set.title);
    setWords(rows ?? []);
  }, [setId]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const word = words[index];
  const isFirst = index === 0;
  const isLast = index === words.length - 1;
  const move = (next: number) => setIndex(next);

  return (
    <View className="flex-1 bg-blush">
      <ScreenHeader
        title="단어 암기"
        back
        right={
          words.length > 0 ? (
            <View className="rounded-full bg-white/25 px-2.5 py-1">
              <Text className="text-sm font-bold text-white">
                {index + 1} / {words.length}
              </Text>
            </View>
          ) : undefined
        }
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : error || !word ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-base font-semibold text-red-500">
            {error ?? "등록된 단어가 없어요."}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerClassName="px-6 py-6 gap-5">
          <View className="flex-row items-center justify-between">
            <Text className="flex-1 text-base font-bold text-ink-soft">
              {title}
            </Text>
          </View>

          <View className="h-2 rounded-full bg-white">
            <View
              className="h-2 rounded-full"
              style={{
                width: `${((index + 1) / words.length) * 100}%`,
                backgroundColor: categoryColors.vocab.fg,
              }}
            />
          </View>

          <View
            className="rounded-3xl px-6 py-10"
            style={{
              backgroundColor: categoryColors.vocab.bg,
              borderWidth: 1,
              borderColor: categoryColors.vocab.border,
            }}
          >
            <Text className="text-center text-5xl font-extrabold text-ink">
              {word.word}
            </Text>

            <View className="mt-8 items-center rounded-2xl bg-white px-4 py-5">
              <Text
                className="text-center text-2xl font-bold"
                style={{ color: categoryColors.vocab.fg }}
              >
                {word.meaning}
              </Text>
            </View>

            {word.example && (
              <View className="mt-4 rounded-2xl bg-white/70 px-4 py-4">
                <Text
                  className="text-sm font-bold"
                  style={{ color: categoryColors.vocab.fg }}
                >
                  예시 문장
                </Text>
                <Text className="mt-1 text-lg leading-7 text-ink">
                  {word.example}
                </Text>
                {word.example_meaning && (
                  <Text className="mt-2 text-base leading-6 text-ink-soft">
                    {word.example_meaning}
                  </Text>
                )}
              </View>
            )}
          </View>

          <View className="flex-row gap-3">
            <Pressable
              onPress={() => move(index - 1)}
              disabled={isFirst}
              style={{ opacity: isFirst ? 0.4 : 1 }}
              className="flex-1 flex-row items-center justify-center gap-1 rounded-2xl border border-line bg-white py-4"
            >
              <Ionicons name="chevron-back" size={20} color={colors.inkSoft} />
              <Text className="text-lg font-bold text-ink-soft">이전</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                isLast ? router.replace(`/test/${setId}`) : move(index + 1)
              }
              className="flex-1 flex-row items-center justify-center gap-1 rounded-2xl bg-brand py-4 shadow-md shadow-brand/40"
            >
              <Text className="text-lg font-bold text-white">
                {isLast ? "테스트 하러 가기" : "다음"}
              </Text>
              {!isLast && (
                <Ionicons name="chevron-forward" size={20} color="#ffffff" />
              )}
            </Pressable>
          </View>
        </ScrollView>
      )}
    </View>
  );
}
