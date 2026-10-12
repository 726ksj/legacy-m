import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { brandGradient, colors } from "../../lib/theme";
import {
  answerReviewQuestion,
  friendlyReviewError,
  getReviewSession,
  GRADUATION_STEPS,
  startReviewSession,
  type ReviewQuestion,
  type ReviewSession,
} from "../../lib/wrongNotes";
import AnswerActions from "../../components/AnswerActions";
import ChoiceButton from "../../components/ChoiceButton";
import ScreenHeader from "../../components/ScreenHeader";

const firstUnanswered = (session: ReviewSession) =>
  session.questions.find((question) => question.selected_index === null)
    ?.position ?? null;

// 문제를 풀기 전: 마스터까지 남은 횟수 / 푼 뒤: 마스터, 마스터 칸 변화 안내.
function ProgressHint({ question }: { question: ReviewQuestion }) {
  const answered = question.selected_index !== null;
  const remaining = GRADUATION_STEPS - question.streak;

  if (!answered) {
    return (
      <View className="rounded-full bg-cream px-3 py-1">
        <Text className="text-sm font-bold text-berry">
          마스터까지 {remaining}번 남았어요
        </Text>
      </View>
    );
  }
  if (question.graduated) {
    return (
      <View className="flex-row items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1">
        <Ionicons name="school" size={14} color="#059669" />
        <Text className="text-sm font-bold text-emerald-600">
          마스터했어요!
        </Text>
      </View>
    );
  }
  if (question.is_correct) {
    return (
      <View className="rounded-full bg-cream px-3 py-1">
        <Text className="text-sm font-bold text-berry">
          마스터까지 {remaining}번 남았어요 (내일 다시 맞히면 돼요)
        </Text>
      </View>
    );
  }
  return (
    <View className="rounded-full bg-red-50 px-3 py-1">
      <Text className="text-sm font-bold text-red-500">
        마스터 칸이 처음부터 다시 시작돼요
      </Text>
    </View>
  );
}

function ResultView({ session }: { session: ReviewSession }) {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const graduatedCount = session.questions.filter((q) => q.graduated).length;
  const oneMoreCount = session.questions.filter(
    (q) => q.is_correct && !q.graduated,
  ).length;
  const wrongQuestions = session.questions.filter(
    (q) => q.is_correct === false,
  );
  const remainingAfter = session.remaining_after ?? 0;

  const continueReview = async () => {
    setStarting(true);
    setError(null);
    try {
      const nextId = await startReviewSession(session.week);
      router.replace(`/review/${nextId}`);
    } catch (e) {
      setError(friendlyReviewError(e));
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
          오답 다시 풀기 결과
        </Text>
        <Text className="mt-1 text-5xl font-extrabold text-white">
          {session.correct_count} / {session.total_count} 정답
        </Text>
        <Text className="mt-2 text-base text-white/90">
          남은 오답 {session.remaining_before} → {remainingAfter}
        </Text>
      </LinearGradient>

      <View className="flex-row gap-3">
        <View className="flex-1 items-center rounded-2xl border border-line bg-white py-4">
          <Text className="text-3xl font-extrabold text-emerald-600">
            {graduatedCount}
          </Text>
          <Text className="mt-1 text-sm text-ink-soft">마스터</Text>
        </View>
        <View className="flex-1 items-center rounded-2xl border border-line bg-white py-4">
          <Text className="text-3xl font-extrabold text-berry">
            {oneMoreCount}
          </Text>
          <Text className="mt-1 text-sm text-ink-soft">한 번 더</Text>
        </View>
        <View className="flex-1 items-center rounded-2xl border border-line bg-white py-4">
          <Text className="text-3xl font-extrabold text-red-500">
            {wrongQuestions.length}
          </Text>
          <Text className="mt-1 text-sm text-ink-soft">또 틀림</Text>
        </View>
      </View>

      {wrongQuestions.length > 0 && (
        <View className="gap-3">
          <Text className="text-base font-bold text-ink-soft">또 틀린 단어</Text>
          {wrongQuestions.map((question) => (
            <View
              key={question.position}
              className="rounded-2xl border border-line bg-white px-4 py-3"
            >
              <Text className="text-lg font-bold text-ink">
                {question.word}
              </Text>
              <Text className="mt-1 text-base text-emerald-700">
                {question.correct_index !== null
                  ? question.choices[question.correct_index]
                  : ""}
              </Text>
              {question.example && (
                <Text className="mt-1 text-sm text-ink-soft">
                  {question.example}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      {error && (
        <View className="rounded-xl bg-red-50 px-4 py-3">
          <Text className="text-base font-semibold text-red-500">{error}</Text>
        </View>
      )}

      <View className="gap-3">
        {remainingAfter > 0 && (
          <Pressable
            onPress={continueReview}
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
                남은 오답 이어서 풀기
              </Text>
            )}
          </Pressable>
        )}
        <Pressable
          onPress={() => router.replace("/wrong")}
          className="items-center rounded-2xl border border-line bg-white py-4"
        >
          <Text className="text-lg font-bold text-ink-soft">
            오답노트로 돌아가기
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

export default function ReviewScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [session, setSession] = useState<ReviewSession | null>(null);
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
      data: { session: authSession },
    } = await supabase.auth.getSession();
    if (!authSession) {
      router.replace("/login");
      return;
    }

    try {
      const loaded = await getReviewSession(sessionId);
      setSession(loaded);
      setPosition(firstUnanswered(loaded));
      setShowResult(loaded.status === "completed");
    } catch (e) {
      setError(friendlyReviewError(e));
    }
  }, [sessionId]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const question =
    session?.questions.find((item) => item.position === position) ?? null;
  const answered =
    question?.selected_index !== null && question?.selected_index !== undefined;

  const onConfirm = async () => {
    if (
      !session ||
      !question ||
      answered ||
      submitting ||
      pendingIndex === null
    )
      return;
    setSubmitting(true);
    setError(null);
    try {
      await answerReviewQuestion(session.id, question.position, pendingIndex);
      // 서버가 확정한 정답/예시 문장/마스터 상태를 다시 받아 화면에 반영한다.
      setSession(await getReviewSession(session.id));
      setPendingIndex(null);
    } catch (e) {
      setError(friendlyReviewError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const onNext = () => {
    if (!session) return;
    setPendingIndex(null);
    if (session.status === "completed") {
      setShowResult(true);
      return;
    }
    setPosition(firstUnanswered(session));
  };

  return (
    <View className="flex-1 bg-blush">
      <ScreenHeader
        title="오답 다시 풀기"
        back
        right={
          session && !showResult ? (
            <View className="rounded-full bg-white/25 px-2.5 py-1">
              <Text className="text-sm font-bold text-white">
                {question?.position ?? session.total_count} /{" "}
                {session.total_count}
              </Text>
            </View>
          ) : undefined
        }
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : !session ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-base font-semibold text-red-500">
            {error ?? "오답 풀이를 불러오지 못했어요."}
          </Text>
        </View>
      ) : showResult ? (
        <ResultView session={session} />
      ) : (
        question && (
          <ScrollView contentContainerClassName="px-6 py-6 gap-6">
            <View className="h-2 rounded-full bg-white">
              <View
                className="h-2 rounded-full bg-brand"
                style={{
                  width: `${(question.position / session.total_count) * 100}%`,
                }}
              />
            </View>

            <View className="items-center rounded-3xl border border-line bg-white px-4 py-10 shadow-sm shadow-brand/20">
              <ProgressHint question={question} />
              <Text className="mt-5 text-center text-4xl font-extrabold text-ink">
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
              </View>
            )}

            {error && (
              <View className="rounded-xl bg-red-50 px-4 py-3">
                <Text className="text-base font-semibold text-red-500">
                  {error}
                </Text>
              </View>
            )}

            <AnswerActions
              answered={answered}
              hasSelection={pendingIndex !== null}
              submitting={submitting}
              onCancel={() => setPendingIndex(null)}
              onConfirm={onConfirm}
              onNext={onNext}
              nextLabel={
                session.status === "completed" ? "결과 보기" : "다음 문제"
              }
            />
          </ScrollView>
        )
      )}
    </View>
  );
}
