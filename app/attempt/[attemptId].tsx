import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { Text } from "../../components/AppText";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "../../lib/supabase";
import { brandGradient, colors } from "../../lib/theme";
import AnswerActions from "../../components/AnswerActions";
import AttemptReview from "../../components/AttemptReview";
import ChoiceButton from "../../components/ChoiceButton";
import ScreenHeader from "../../components/ScreenHeader";
import {
  answerQuestion,
  friendlyTestError,
  getAttempt,
  getTestStatus,
  roundTitle,
  startAttempt,
  startLabel,
  type Attempt,
  type TestStatus,
} from "../../lib/test";

const firstUnanswered = (attempt: Attempt) =>
  attempt.questions.find((question) => question.selected_index === null)
    ?.position ?? null;

function ResultView({ attempt }: { attempt: Attempt }) {
  const [status, setStatus] = useState<TestStatus | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTestStatus(attempt.vocab_set_id)
      .then(setStatus)
      .catch((e) => setError(friendlyTestError(e)));
  }, [attempt.vocab_set_id]);

  const wrongQuestions = attempt.questions.filter(
    (question) => question.is_correct === false,
  );
  const nextRound = status?.next_round ?? null;

  const startNext = async () => {
    setStarting(true);
    setError(null);
    try {
      const nextAttemptId = await startAttempt(attempt.vocab_set_id);
      router.replace(`/attempt/${nextAttemptId}`);
    } catch (e) {
      setError(friendlyTestError(e));
      setStarting(false);
    }
  };

  return (
    <ScrollView contentContainerClassName="px-6 py-6 gap-6">
      <LinearGradient
        colors={brandGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 28, paddingHorizontal: 22, paddingVertical: 24 }}
      >
        <Text className="text-sm font-bold text-cream">
          {roundTitle(attempt.round_no)}
        </Text>
        <Text className="mt-1 text-6xl font-extrabold text-white">
          {attempt.score}점
        </Text>
        <Text className="mt-2 text-base text-white/90">
          {attempt.total_count}문제 중 {attempt.correct_count}개 정답 · 오답{" "}
          {wrongQuestions.length}개
        </Text>
      </LinearGradient>

      <AttemptReview questions={attempt.questions} />

      {error && (
        <View className="rounded-xl bg-red-50 px-4 py-3">
          <Text className="text-base font-semibold text-red-500">{error}</Text>
        </View>
      )}

      <View className="gap-3">
        {nextRound !== null && (
          <Pressable
            onPress={startNext}
            disabled={starting}
            style={({ pressed }) => ({
              opacity: pressed || starting ? 0.8 : 1,
            })}
            className="items-center rounded-2xl bg-brand py-4 shadow-md shadow-brand/40"
          >
            {starting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-lg font-bold text-white">
                {startLabel(nextRound)}
              </Text>
            )}
          </Pressable>
        )}
        <Pressable
          onPress={() => router.replace(`/test/${attempt.vocab_set_id}`)}
          className="items-center rounded-2xl border border-line bg-white py-4"
        >
          <Text className="text-lg font-bold text-ink-soft">
            {nextRound === null ? "완료" : "나중에 하기"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

export default function AttemptScreen() {
  const { attemptId } = useLocalSearchParams<{ attemptId: string }>();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [position, setPosition] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  // 보기를 눌러 둔(아직 확정하지 않은) 번호. 확인을 눌러야 답이 확정된다.
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
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
      const loaded = await getAttempt(attemptId);
      setAttempt(loaded);
      const next = firstUnanswered(loaded);
      setPosition(next);
      setShowResult(loaded.status === "completed");
    } catch (e) {
      setError(friendlyTestError(e));
    }
  }, [attemptId]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const question =
    attempt?.questions.find((item) => item.position === position) ?? null;
  const answered =
    question?.selected_index !== null && question?.selected_index !== undefined;

  const onConfirm = async () => {
    if (
      !attempt ||
      !question ||
      answered ||
      submitting ||
      pendingIndex === null
    )
      return;
    setSubmitting(true);
    setError(null);
    try {
      await answerQuestion(attempt.id, question.position, pendingIndex);
      // 서버가 확정한 정답/예시 문장을 다시 받아 화면에 반영한다.
      setAttempt(await getAttempt(attempt.id));
      setPendingIndex(null);
    } catch (e) {
      setError(friendlyTestError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const onNext = () => {
    if (!attempt) return;
    setPendingIndex(null);
    if (attempt.status === "completed") {
      setShowResult(true);
      return;
    }
    setPosition(firstUnanswered(attempt));
  };

  const title = attempt ? roundTitle(attempt.round_no) : "단어 테스트";

  return (
    <View className="flex-1 bg-blush">
      <ScreenHeader
        title={title}
        back
        right={
          attempt && !showResult ? (
            <View className="min-w-[72px] items-center rounded-full bg-white/25 px-2.5 py-1">
              <Text className="text-sm font-bold text-white">
                {question?.position ?? attempt.total_count} /{" "}
                {attempt.total_count}
              </Text>
            </View>
          ) : undefined
        }
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : !attempt ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-base font-semibold text-red-500">
            {error ?? "테스트를 불러오지 못했어요."}
          </Text>
        </View>
      ) : showResult ? (
        <ResultView attempt={attempt} />
      ) : (
        question && (
          <View className="flex-1">
          <ScrollView className="flex-1" contentContainerClassName="px-6 py-6 gap-6">
            <View>
              <View className="h-2 rounded-full bg-white">
                <View
                  className="h-2 rounded-full bg-brand"
                  style={{
                    width: `${(question.position / attempt.total_count) * 100}%`,
                  }}
                />
              </View>
            </View>

            <View className="items-center rounded-3xl border border-line bg-white px-4 py-10 shadow-sm shadow-brand/20">
              <View className="rounded-full bg-cream px-3 py-1">
                <Text className="text-sm font-bold text-berry">
                  이 단어의 뜻은?
                </Text>
              </View>
              <Text className="mt-4 text-center text-4xl font-extrabold text-ink">
                {question.word}
              </Text>
            </View>

            <View className="gap-3">
              {question.choices.map((text, index) => (
                <ChoiceButton
                  key={index}
                  index={index}
                  text={text}
                  question={question}
                  disabled={answered || submitting}
                  pending={pendingIndex === index}
                  onPress={() => setPendingIndex(index)}
                />
              ))}
            </View>

            {answered && question.example && (
              <View className="rounded-2xl bg-cream/40 px-4 py-3">
                <Text className="text-sm font-bold text-berry">예시 문장</Text>
                <Text className="mt-1 text-base text-ink">
                  {question.example}
                </Text>
                {question.example_meaning && (
                  <Text className="mt-1.5 text-sm text-ink-soft">
                    {question.example_meaning}
                  </Text>
                )}
              </View>
            )}

            {error && (
              <View className="rounded-xl bg-red-50 px-4 py-3">
                <Text className="text-base font-semibold text-red-500">
                  {error}
                </Text>
              </View>
            )}
          </ScrollView>
          {/* 취소/확인/다음 문제 버튼은 스크롤 밖 화면 맨 아래에 고정한다. */}
          <View className="px-6 pb-6 pt-3">
          <AnswerActions
            answered={answered}
            hasSelection={pendingIndex !== null}
            submitting={submitting}
            onCancel={() => setPendingIndex(null)}
            onConfirm={onConfirm}
            onNext={onNext}
            nextLabel={
              attempt.status === "completed" ? "결과 보기" : "다음 문제"
            }
          />
          </View>
          </View>
        )
      )}
    </View>
  );
}
