import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { Text } from "../../components/AppText";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "../../lib/supabase";
import { brandGradient, colors } from "../../lib/theme";
import ScreenHeader from "../../components/ScreenHeader";
import EmptyState from "../../components/EmptyState";
import {
  friendlyTestError,
  getAttempt,
  ROUND_TITLE,
  type Attempt,
  type AttemptQuestion,
} from "../../lib/test";

type Filter = "wrong" | "all";

// 문항 하나: 단어, 내가 고른 답(오답이면 빨강), 정답(초록), 예시 문장.
function QuestionRow({ question }: { question: AttemptQuestion }) {
  const wrong = question.is_correct === false;
  const picked =
    question.selected_index !== null
      ? question.choices[question.selected_index]
      : null;
  const correct =
    question.correct_index !== null
      ? question.choices[question.correct_index]
      : null;

  return (
    <View
      className={`rounded-2xl border px-4 py-3 ${
        wrong ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"
      }`}
    >
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 text-lg font-bold text-ink">
          {question.position}. {question.word}
        </Text>
        <View
          className={`rounded-full px-2.5 py-0.5 ${
            wrong ? "bg-red-100" : "bg-emerald-100"
          }`}
        >
          <Text
            className={`text-xs font-bold ${
              wrong ? "text-red-600" : "text-emerald-700"
            }`}
          >
            {wrong ? "오답" : "정답"}
          </Text>
        </View>
      </View>
      {wrong && picked && (
        <Text className="mt-2 text-base text-red-500">
          내가 고른 답: {picked}
        </Text>
      )}
      {correct && (
        <Text className="mt-1 text-base text-emerald-700">
          정답: {correct}
        </Text>
      )}
      {question.example && (
        <Text className="mt-1.5 text-sm text-ink-soft">{question.example}</Text>
      )}
      {question.example_meaning && (
        <Text className="mt-0.5 text-sm text-ink-soft">
          {question.example_meaning}
        </Text>
      )}
    </View>
  );
}

// 응시를 마친 회차의 결과: 점수와 어떤 문제를 틀렸는지 다시 본다.
export default function AttemptReviewScreen() {
  const { attemptId } = useLocalSearchParams<{ attemptId: string }>();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [filter, setFilter] = useState<Filter>("wrong");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    try {
      setAttempt(await getAttempt(attemptId));
    } catch (e) {
      setError(friendlyTestError(e));
    }
  }, [attemptId]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const wrongQuestions =
    attempt?.questions.filter((q) => q.is_correct === false) ?? [];
  const shown =
    filter === "wrong" ? wrongQuestions : (attempt?.questions ?? []);

  return (
    <View className="flex-1 bg-blush">
      <ScreenHeader
        title={attempt ? ROUND_TITLE[attempt.round_no] : "시험 결과"}
        back
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : !attempt ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-base font-semibold text-red-500">
            {error ?? "결과를 불러오지 못했어요."}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerClassName="px-6 py-6 gap-5">
          <LinearGradient
            colors={brandGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 28,
              paddingHorizontal: 22,
              paddingVertical: 22,
            }}
          >
            <Text className="text-5xl font-extrabold text-white">
              {attempt.score ?? 0}점
            </Text>
            <Text className="mt-2 text-base text-white/90">
              {attempt.total_count}문제 중 {attempt.correct_count ?? 0}개 정답 ·
              오답 {wrongQuestions.length}개
            </Text>
          </LinearGradient>

          <View className="flex-row gap-2">
            {(
              [
                ["wrong", `틀린 문제 ${wrongQuestions.length}`],
                ["all", `전체 ${attempt.questions.length}`],
              ] as const
            ).map(([key, label]) => (
              <Pressable
                key={key}
                onPress={() => setFilter(key)}
                className={`rounded-full border px-4 py-2 ${
                  filter === key
                    ? "border-brand bg-brand"
                    : "border-line bg-white"
                }`}
              >
                <Text
                  className={`text-sm font-bold ${
                    filter === key ? "text-white" : "text-ink-soft"
                  }`}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          {shown.length === 0 ? (
            <EmptyState
              icon="checkmark-circle-outline"
              title="틀린 문제가 없어요"
              description="모든 문제를 맞혔어요"
            />
          ) : (
            <View className="gap-3">
              {shown.map((question) => (
                <QuestionRow key={question.position} question={question} />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
