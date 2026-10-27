import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "../../lib/supabase";
import { brandGradient, categoryColors, colors } from "../../lib/theme";
import {
  answerOrderQuestion,
  friendlyOrderError,
  getOrderProgress,
  startOrderAttempt,
  type OrderAttempt,
  type OrderProgress,
} from "../../lib/order";
import AnswerActions from "../../components/AnswerActions";
import ChoiceButton from "../../components/ChoiceButton";
import ScreenHeader from "../../components/ScreenHeader";
import { ROUND_TITLE } from "../../lib/test";
import { Text } from "../../components/AppText";

const palette = categoryColors.order;

// 모든 문제를 푼 뒤: 점수와 문제별 정오.
function Summary({ progress }: { progress: OrderProgress }) {
  return (
    <ScrollView contentContainerClassName="px-6 py-6 gap-6">
      <LinearGradient
        colors={brandGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 28, paddingHorizontal: 22, paddingVertical: 24 }}
      >
        <Text className="text-sm font-bold text-cream">
          {ROUND_TITLE[progress.round_no]} · {progress.title}
        </Text>
        <Text className="mt-1 text-5xl font-extrabold text-white">
          {progress.score ?? 0}점
        </Text>
        <Text className="mt-2 text-base text-white/90">
          {progress.total}문제 중 {progress.correct}개 정답
        </Text>
      </LinearGradient>

      {(progress.is_late || progress.is_overdue) && (
        <View
          className={`rounded-xl px-4 py-3 ${
            progress.is_overdue ? "bg-red-50" : "bg-amber-50"
          }`}
        >
          <Text
            className={`text-base font-bold ${
              progress.is_overdue ? "text-red-600" : "text-amber-700"
            }`}
          >
            {progress.is_overdue ? "기한 초과로 응시했어요" : "지각 응시로 기록됐어요"}
          </Text>
        </View>
      )}

      <View className="flex-row flex-wrap gap-2">
        {progress.questions.map((item) => (
          <View
            key={item.question_id}
            className={`h-12 w-12 items-center justify-center rounded-2xl ${
              item.is_correct ? "bg-emerald-100" : "bg-red-100"
            }`}
          >
            <Text
              className={`text-base font-bold ${
                item.is_correct ? "text-emerald-700" : "text-red-600"
              }`}
            >
              {item.order_no}
            </Text>
          </View>
        ))}
      </View>

      <Pressable
        onPress={() => router.back()}
        className="items-center rounded-2xl bg-brand py-4 shadow-md shadow-brand/40"
      >
        <Text className="text-lg font-bold text-white">완료</Text>
      </Pressable>
    </ScrollView>
  );
}

export default function OrderScreen() {
  const { setId, round: roundParam } = useLocalSearchParams<{ setId: string; round?: string }>();
  // 회차 현황 화면에서 넘겨 준 회차. 없으면 서버가 지금 풀 회차를 정한다.
  const round = Number(roundParam) || undefined;
  const [progress, setProgress] = useState<OrderProgress | null>(null);
  const [position, setPosition] = useState(0);
  const [attempt, setAttempt] = useState<OrderAttempt | null>(null);
  const [correctOption, setCorrectOption] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // i번째 문제를 서버에서 받아 온다(처음이면 서버가 섞고, 다시 열면 같은 배치).
  const openQuestion = useCallback(async (loaded: OrderProgress, index: number) => {
    setAttempt(null);
    setCorrectOption(null);
    setPendingIndex(null);
    setPosition(index);
    setAttempt(await startOrderAttempt(loaded.questions[index].question_id, loaded.round_no));
  }, []);

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
      const loaded = await getOrderProgress(setId, round);
      setProgress(loaded);
      if (loaded.completed || loaded.total === 0) {
        setShowSummary(true);
        return;
      }
      // 아직 안 푼 첫 문제부터 시작한다(풀던 문제는 같은 배치로 이어진다).
      const firstOpen = loaded.questions.findIndex((q) => !q.answered);
      await openQuestion(loaded, Math.max(firstOpen, 0));
    } catch (e) {
      setError(friendlyOrderError(e));
    }
  }, [setId, round, openQuestion]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onConfirm = async () => {
    if (!attempt || pendingIndex === null) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await answerOrderQuestion(attempt.attempt_id, pendingIndex);
      setAttempt(result);
      setCorrectOption(result.correct_option);
      setPendingIndex(null);
      // 진행 상황(점수, 완료 여부)을 다시 받아 둔다.
      setProgress(await getOrderProgress(setId, round));
    } catch (e) {
      setError(friendlyOrderError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const onNext = async () => {
    if (!progress) return;
    const latest = await getOrderProgress(setId, round).catch(() => progress);
    setProgress(latest);
    const nextIndex = latest.questions.findIndex(
      (q, i) => i > position && !q.answered,
    );
    if (nextIndex === -1) {
      setShowSummary(true);
      return;
    }
    setLoading(true);
    try {
      await openQuestion(latest, nextIndex);
    } catch (e) {
      setError(friendlyOrderError(e));
    } finally {
      setLoading(false);
    }
  };

  const total = progress?.total ?? 0;
  const isLast =
    progress !== null &&
    !progress.questions.some((q, i) => i > position && !q.answered);

  return (
    <View className="flex-1 bg-blush">
      <ScreenHeader
        title={progress ? ROUND_TITLE[progress.round_no] : "순서 배열"}
        back
        right={
          progress && !showSummary ? (
            <View className="rounded-full bg-white/25 px-2.5 py-1">
              <Text className="text-sm font-bold text-white">
                {position + 1} / {total}
              </Text>
            </View>
          ) : undefined
        }
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : showSummary && progress ? (
        <Summary progress={progress} />
      ) : !attempt ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-base font-semibold text-red-500">
            {error ?? "문제를 불러오지 못했어요."}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerClassName="px-6 py-6 gap-5">
          <View className="h-2 rounded-full bg-white">
            <View
              className="h-2 rounded-full bg-brand"
              style={{ width: `${((position + 1) / Math.max(total, 1)) * 100}%` }}
            />
          </View>

          <View
            className="rounded-3xl px-5 py-5"
            style={{ backgroundColor: palette.bg, borderWidth: 1, borderColor: palette.border }}
          >
            <View
              className="self-start rounded-full px-3 py-1"
              style={{ backgroundColor: palette.accent }}
            >
              <Text className="text-sm font-bold" style={{ color: palette.fg }}>
                주어진 글
              </Text>
            </View>
            <Text className="mt-3 text-base font-semibold leading-6 text-ink">
              {attempt.intro}
            </Text>
          </View>

          <View className="gap-3">
            {attempt.parts.map((part) => (
              <View
                key={part.label}
                className="rounded-3xl border border-line bg-white px-5 py-4 shadow-sm shadow-brand/20"
              >
                <Text className="text-base font-extrabold text-berry">
                  ({part.label})
                </Text>
                <Text className="mt-1.5 text-base leading-6 text-ink">
                  {part.text}
                </Text>
              </View>
            ))}
          </View>

          <Text className="text-base font-bold text-ink-soft">
            글의 순서로 가장 적절한 것은?
          </Text>

          <View className="gap-3">
            {attempt.options.map((text, index) => (
              <ChoiceButton
                key={index}
                index={index}
                text={text}
                question={attempt}
                disabled={attempt.answered || submitting}
                pending={pendingIndex === index}
                onPress={() => setPendingIndex(index)}
              />
            ))}
          </View>

          {attempt.answered && correctOption && (
            <View
              className={`rounded-2xl px-4 py-3 ${
                attempt.is_correct ? "bg-emerald-50" : "bg-red-50"
              }`}
            >
              <Text
                className={`text-base font-bold ${
                  attempt.is_correct ? "text-emerald-700" : "text-red-600"
                }`}
              >
                {attempt.is_correct ? "정답이에요!" : "아쉬워요"}
              </Text>
              <Text className="mt-0.5 text-base text-ink">
                정답: {correctOption}
              </Text>
            </View>
          )}

          {error && (
            <View className="rounded-xl bg-red-50 px-4 py-3">
              <Text className="text-base font-semibold text-red-500">{error}</Text>
            </View>
          )}

          <AnswerActions
            answered={attempt.answered}
            hasSelection={pendingIndex !== null}
            submitting={submitting}
            onCancel={() => setPendingIndex(null)}
            onConfirm={onConfirm}
            onNext={onNext}
            nextLabel={isLast ? "결과 보기" : "다음 문제"}
          />
        </ScrollView>
      )}
    </View>
  );
}
