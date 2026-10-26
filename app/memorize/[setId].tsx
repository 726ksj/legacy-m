import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { Text } from "../../components/AppText";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { categoryColors, colors } from "../../lib/theme";
import ScreenHeader from "../../components/ScreenHeader";
import TextMemorize from "../../components/TextMemorize";
import { isTestKind } from "../../lib/study";

interface MemorizeWord {
  id: string;
  word: string;
  meaning: string;
  example: string | null;
  example_meaning: string | null;
}

// V01 단어 암기: 단어 · 뜻 · 예시 문장 · 예시 문장 뜻을 한 카드에 보여주고 이전/다음으로 넘긴다.
function VocabMemorize() {
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
  // 마지막 단어에서 완료하면 학습 화면(단어(VOCA))으로 돌아간다.
  const finish = () => (router.canGoBack() ? router.back() : router.replace("/learn/vocab"));

  return (
    <View className="flex-1 bg-blush">
      <ScreenHeader
        title="단어 암기"
        back
        right={
          words.length > 0 ? (
            <View className="min-w-[72px] items-center rounded-full bg-white/25 px-2.5 py-1">
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
        // 카드 영역만 남는 높이를 채우고(내용이 길면 카드 안에서 스크롤), 진행 바와
        // 이전/다음 버튼은 단어가 바뀌어도 같은 자리에 고정한다.
        <View className="flex-1 gap-4 px-6 pb-6 pt-5">
          <Text className="text-base font-bold text-ink-soft" numberOfLines={1}>
            {title}
          </Text>

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
            className="flex-1 overflow-hidden rounded-3xl"
            style={{
              backgroundColor: categoryColors.vocab.bg,
              borderWidth: 1,
              borderColor: categoryColors.vocab.border,
            }}
          >
           <ScrollView contentContainerClassName="px-6 py-8">
            {/* 단어·뜻·예시 문장 칸은 내용 길이와 관계없이 높이를 고정한다(예시 문장은 칸 안에서 스크롤). */}
            <View className="h-16 justify-center">
              <Text
                className="text-center text-5xl font-extrabold text-ink"
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {word.word}
              </Text>
            </View>

            <View className="mt-6 h-20 items-center justify-center rounded-2xl bg-white px-4">
              <Text
                className="text-center text-2xl font-bold"
                style={{ color: categoryColors.vocab.fg }}
                numberOfLines={2}
                adjustsFontSizeToFit
              >
                {word.meaning}
              </Text>
            </View>

            <View className="mt-4 h-48 rounded-2xl bg-white/70">
              <ScrollView
                nestedScrollEnabled
                contentContainerClassName="px-4 py-4"
                showsVerticalScrollIndicator={false}
              >
                <Text
                  className="text-sm font-bold"
                  style={{ color: categoryColors.vocab.fg }}
                >
                  예시 문장
                </Text>
                {word.example ? (
                  <>
                    <Text className="mt-1 text-lg leading-7 text-ink">
                      {word.example}
                    </Text>
                    {word.example_meaning && (
                      <Text className="mt-2 text-base leading-6 text-ink-soft">
                        {word.example_meaning}
                      </Text>
                    )}
                  </>
                ) : (
                  <Text className="mt-1 text-base text-ink-soft">
                    예시 문장이 없어요.
                  </Text>
                )}
              </ScrollView>
            </View>
           </ScrollView>
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
                isLast ? finish() : move(index + 1)
              }
              className="flex-1 flex-row items-center justify-center gap-1 rounded-2xl bg-brand py-4 shadow-md shadow-brand/40"
            >
              <Text className="text-lg font-bold text-white">
                {isLast ? "완료" : "다음"}
              </Text>
              {!isLast && (
                <Ionicons name="chevron-forward" size={20} color="#ffffff" />
              )}
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

// 암기 화면 진입점. ?kind=writing|order|sentence면 문장형 암기, 없으면 단어 암기.
export default function MemorizeScreen() {
  const { setId, kind } = useLocalSearchParams<{ setId: string; kind?: string }>();
  if (isTestKind(kind) && kind !== "vocab") {
    return <TextMemorize kind={kind} setId={setId} />;
  }
  return <VocabMemorize />;
}
