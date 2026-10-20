import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "../../lib/supabase";
import { brandGradient, categoryColors, colors } from "../../lib/theme";
import {
  answerSentenceQuestion,
  friendlySentenceError,
  getSentenceProgress,
  startSentenceAttempt,
  type SentenceAttempt,
  type SentenceProgress,
} from "../../lib/sentence";
import ScreenHeader from "../../components/ScreenHeader";
import { Text } from "../../components/AppText";

const palette = categoryColors.sentence;

// 모든 문제를 푼 뒤: 점수와 문제별 정오.
function Summary({ progress }: { progress: SentenceProgress }) {
  return (
    <ScrollView contentContainerClassName="px-6 py-6 gap-6">
      <LinearGradient
        colors={brandGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 28, paddingHorizontal: 22, paddingVertical: 24 }}
      >
        <Text className="text-sm font-bold text-cream">{progress.title}</Text>
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

export default function SentenceScreen() {
  const { setId } = useLocalSearchParams<{ setId: string }>();
  const [progress, setProgress] = useState<SentenceProgress | null>(null);
  const [position, setPosition] = useState(0);
  const [attempt, setAttempt] = useState<SentenceAttempt | null>(null);
  // 학생이 고른 순서: 고른 순서대로 적은 화면 자리 번호(1부터).
  const [picked, setPicked] = useState<number[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // i번째 문제를 서버에서 받아 온다(처음이면 서버가 섞고, 다시 열면 같은 배치).
  const openQuestion = useCallback(async (loaded: SentenceProgress, index: number) => {
    setAttempt(null);
    setPicked([]);
    setPosition(index);
    setAttempt(await startSentenceAttempt(loaded.questions[index].question_id));
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
      const loaded = await getSentenceProgress(setId);
      setProgress(loaded);
      if (loaded.completed || loaded.total === 0) {
        setShowSummary(true);
        return;
      }
      // 아직 안 푼 첫 문제부터 시작한다(풀던 문제는 같은 배치로 이어진다).
      const firstOpen = loaded.questions.findIndex((q) => !q.answered);
      await openQuestion(loaded, Math.max(firstOpen, 0));
    } catch (e) {
      setError(friendlySentenceError(e));
    }
  }, [setId, openQuestion]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const total = attempt?.sentences.length ?? 0;
  const complete = attempt !== null && picked.length === total;

  // 문장을 누르면 내 순서에 더하고, 이미 고른 문장을 누르면 그 문장부터 뒤를 빼서 다시 고른다.
  const onPickSentence = (place: number) => {
    if (!attempt || attempt.answered || submitting) return;
    const at = picked.indexOf(place);
    setPicked(at === -1 ? [...picked, place] : picked.slice(0, at));
  };

  const onConfirm = async () => {
    if (!attempt || !complete) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await answerSentenceQuestion(attempt.attempt_id, picked);
      setAttempt(result);
      setProgress(await getSentenceProgress(setId));
    } catch (e) {
      setError(friendlySentenceError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const onNext = async () => {
    if (!progress) return;
    const latest = await getSentenceProgress(setId).catch(() => progress);
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
      setError(friendlySentenceError(e));
    } finally {
      setLoading(false);
    }
  };

  const questionCount = progress?.total ?? 0;
  const isLast =
    progress !== null &&
    !progress.questions.some((q, i) => i > position && !q.answered);

  // 답한 뒤 화면에 보여 줄 내가 고른 순서(예: "C → A → B")와 정답 순서.
  const chosenLabels =
    attempt?.selected_order?.map((place) => attempt.sentences[place - 1]?.label) ?? [];

  return (
    <View className="flex-1 bg-blush">
      <ScreenHeader
        title="문장 배열"
        back
        right={
          progress && !showSummary ? (
            <View className="rounded-full bg-white/25 px-2.5 py-1">
              <Text className="text-sm font-bold text-white">
                {position + 1} / {questionCount}
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
              style={{ width: `${((position + 1) / Math.max(questionCount, 1)) * 100}%` }}
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
                주어진 문장
              </Text>
            </View>
            <Text className="mt-3 text-base font-semibold leading-6 text-ink">
              {attempt.intro}
            </Text>
          </View>

          <Text className="text-base font-bold text-ink-soft">
            {attempt.answered
              ? "정답 순서는 아래 번호와 같아요"
              : "이어지는 순서대로 문장을 눌러 주세요"}
          </Text>

          <View className="gap-3">
            {attempt.sentences.map((sentence, index) => {
              const place = index + 1;
              const order = picked.indexOf(place) + 1; // 0이면 아직 안 고른 문장
              const wrongSpot =
                attempt.answered &&
                attempt.selected_order !== null &&
                attempt.selected_order.indexOf(place) + 1 !== sentence.correct_no;
              return (
                <Pressable
                  key={sentence.label}
                  onPress={() => onPickSentence(place)}
                  disabled={attempt.answered || submitting}
                  style={({ pressed }) => ({ opacity: pressed && !attempt.answered ? 0.85 : 1 })}
                  className={`flex-row rounded-3xl border-2 px-4 py-4 ${
                    attempt.answered
                      ? wrongSpot
                        ? "border-red-300 bg-red-50"
                        : "border-emerald-300 bg-emerald-50"
                      : order > 0
                        ? "border-brand bg-blush"
                        : "border-line bg-white"
                  }`}
                >
                  <View
                    className={`mr-3 h-8 w-8 items-center justify-center rounded-full ${
                      attempt.answered
                        ? "bg-white"
                        : order > 0
                          ? "bg-brand"
                          : "bg-blush"
                    }`}
                  >
                    <Text
                      className={`text-base font-extrabold ${
                        order > 0 && !attempt.answered ? "text-white" : "text-berry"
                      }`}
                    >
                      {attempt.answered ? sentence.correct_no : order > 0 ? order : ""}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-extrabold text-berry">
                      ({sentence.label})
                    </Text>
                    <Text className="mt-1 text-base leading-6 text-ink">
                      {sentence.text}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {!attempt.answered && (
            <Text className="text-center text-sm text-ink-soft">
              {picked.length} / {total}개 선택 · 고른 문장을 다시 누르면 그 뒤 선택이 취소돼요
            </Text>
          )}

          {attempt.answered && (
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
                {attempt.is_correct
                  ? "정답이에요!"
                  : `아쉬워요 · ${attempt.correct_positions ?? 0}/${total}개 자리가 맞았어요`}
              </Text>
              <Text className="mt-1 text-base text-ink">
                내 순서: {chosenLabels.map((l) => `(${l})`).join(" → ")}
              </Text>
              <Text className="mt-0.5 text-base text-ink">
                정답: {attempt.correct_order?.map((l) => `(${l})`).join(" → ")}
              </Text>
            </View>
          )}

          {error && (
            <View className="rounded-xl bg-red-50 px-4 py-3">
              <Text className="text-base font-semibold text-red-500">{error}</Text>
            </View>
          )}

          {attempt.answered ? (
            <Pressable
              onPress={onNext}
              className="items-center rounded-2xl bg-brand py-4 shadow-md shadow-brand/40"
            >
              <Text className="text-lg font-bold text-white">
                {isLast ? "결과 보기" : "다음 문제"}
              </Text>
            </Pressable>
          ) : (
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setPicked([])}
                disabled={picked.length === 0 || submitting}
                style={{ opacity: picked.length > 0 && !submitting ? 1 : 0.4 }}
                className="flex-1 items-center rounded-2xl border border-line bg-white py-4"
              >
                <Text className="text-lg font-bold text-ink-soft">다시 고르기</Text>
              </Pressable>
              <Pressable
                onPress={onConfirm}
                disabled={!complete || submitting}
                style={{ opacity: complete && !submitting ? 1 : 0.4 }}
                className="flex-1 items-center rounded-2xl bg-brand py-4 shadow-md shadow-brand/40"
              >
                {submitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text className="text-lg font-bold text-white">확인</Text>
                )}
              </Pressable>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
