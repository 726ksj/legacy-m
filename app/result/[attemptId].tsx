import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { Text } from "../../components/AppText";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "../../lib/supabase";
import { brandGradient, colors } from "../../lib/theme";
import ScreenHeader from "../../components/ScreenHeader";
import AttemptReview from "../../components/AttemptReview";
import { friendlyTestError, getAttempt, roundTitle, type Attempt } from "../../lib/test";

// 응시를 마친 회차의 결과: 점수와 어떤 문제를 틀렸는지 다시 본다.
export default function AttemptReviewScreen() {
  const { attemptId } = useLocalSearchParams<{ attemptId: string }>();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
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

  const wrongCount =
    attempt?.questions.filter((q) => q.is_correct === false).length ?? 0;

  return (
    <View className="flex-1 bg-blush">
      <ScreenHeader
        title={attempt ? roundTitle(attempt.round_no) : "시험 결과"}
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
              오답 {wrongCount}개
            </Text>
          </LinearGradient>

          <AttemptReview questions={attempt.questions} />
        </ScrollView>
      )}
    </View>
  );
}
