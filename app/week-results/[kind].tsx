import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Text } from "../../components/AppText";
import { supabase } from "../../lib/supabase";
import { categoryColors, colors } from "../../lib/theme";
import { isTestKind, KIND_TITLES } from "../../lib/study";
import {
  defaultWeek,
  fetchCourseResults,
  NO_WEEK,
  testsOfWeek,
  type CourseResults,
} from "../../lib/results";
import ScreenHeader from "../../components/ScreenHeader";
import EmptyState from "../../components/EmptyState";
import TestResultCard from "../../components/TestResultCard";
import ScoreTrendChart from "../../components/ScoreTrendChart";
import { trendOf } from "../../lib/trend";

// 학습 결과 유형 화면: 위에는 이 유형의 주차별 성적 흐름(꺾은선), 아래에는 고른 주차의 시험과 결과.
// 그래프의 점이나 주차를 누르면 아래 목록이 그 주차로 바뀐다.
export default function ResultsKindScreen() {
  const {
    kind: kindParam,
    course: courseKey,
  } = useLocalSearchParams<{ kind: string; course?: string }>();
  const kind = isTestKind(kindParam) ? kindParam : null;
  // 처음에는 이번 주차(이 유형의 점수가 없으면 점수가 있는 가장 최근 주차)를 보여 주고,
  // 이후에는 그래프에서 고른다.
  const [pickedWeek, setPickedWeek] = useState<number | null>(null);

  const [course, setCourse] = useState<CourseResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    const courses = await fetchCourseResults().catch(() => []);
    setCourse(courses.find((c) => c.key === courseKey) ?? courses[0] ?? null);
  }, [courseKey]);

  useFocusEffect(
    useCallback(() => {
      load().finally(() => setLoading(false));
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const title = kind ? KIND_TITLES[kind] : "학습 결과";
  const palette = kind ? categoryColors[kind] : categoryColors.vocab;
  const points = useMemo(() => (course && kind ? trendOf(course, kind) : []), [course, kind]);
  const scored = points.filter((p) => p.score !== null);
  const scoredCount = scored.length;
  const defaultPick = (() => {
    if (!course) return 1;
    const now = defaultWeek(course);
    if (points.some((p) => p.week === now && p.score !== null) || scored.length === 0) return now;
    return scored[scored.length - 1].week;
  })();
  const week = pickedWeek ?? defaultPick;
  // 주차가 지정되지 않은 이 유형의 시험(그래프 칸에는 들어갈 수 없다).
  const noWeekCount =
    course && kind
      ? testsOfWeek(course, NO_WEEK).filter((t) => t.kind === kind && t.status !== "not_started")
          .length
      : 0;
  const weekLabel = week === NO_WEEK ? "주차 미지정" : `${week}주차`;
  // 결과 화면은 응시한 시험만 보여 준다(아직 안 본 시험은 학습 화면에서 본다).
  const tests =
    course && kind
      ? testsOfWeek(course, week).filter(
          (t) => t.kind === kind && t.status !== "not_started",
        )
      : [];

  return (
    <View className="flex-1 bg-blush">
      <ScreenHeader title={title} back />
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : (
        <ScrollView
          contentContainerClassName="px-6 pb-10"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.brand}
            />
          }
        >
          <View className="mt-6 rounded-3xl border border-line bg-white px-3 pb-3 pt-4">
            <Text className="px-2 text-base font-bold text-ink">주차별 성적 흐름</Text>
            {scoredCount === 0 ? (
              <Text className="px-2 pb-3 pt-2 text-sm text-ink-soft">
                시험을 끝내면 주차별 점수가 그래프로 쌓여요
              </Text>
            ) : (
              <>
                <Text className="mb-1 px-2 text-sm text-ink-soft" numberOfLines={1}>
                  주차를 누르면 목록이 바뀌어요
                </Text>
                <ScoreTrendChart
                  points={points}
                  selectedWeek={week}
                  onSelect={setPickedWeek}
                  color={palette.fg}
                  accent={palette.accent}
                />
              </>
            )}
          </View>

          {noWeekCount > 0 && (
            <Pressable
              onPress={() => setPickedWeek(NO_WEEK)}
              className={`mt-3 self-start rounded-full border px-3.5 py-1.5 ${
                week === NO_WEEK ? "border-brand bg-brand" : "border-line bg-white"
              }`}
            >
              <Text
                className={`text-sm font-bold ${week === NO_WEEK ? "text-white" : "text-ink-soft"}`}
              >
                주차 미지정 {noWeekCount}개
              </Text>
            </Pressable>
          )}

          <Text className="mt-6 text-base font-bold text-ink-soft">{weekLabel}</Text>
          {tests.length === 0 ? (
            <EmptyState
              icon="document-text-outline"
              title="응시한 시험이 없어요"
              description="시험을 보면 결과가 여기에 쌓여요"
            />
          ) : (
            <View className="mt-3 gap-3">
              {tests.map((test) => (
                <TestResultCard key={`${test.kind}:${test.id}`} test={test} />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
