import { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Text } from "../../components/AppText";
import { supabase } from "../../lib/supabase";
import { colors } from "../../lib/theme";
import { isTestKind, KIND_TITLES } from "../../lib/study";
import { fetchCourseResults, NO_WEEK, testsOfWeek, type CourseResults } from "../../lib/results";
import ScreenHeader from "../../components/ScreenHeader";
import EmptyState from "../../components/EmptyState";
import TestResultCard from "../../components/TestResultCard";

// 학습 결과 유형 화면: 고른 강좌·주차에서 이 유형의 시험과 결과를 보여 준다.
export default function ResultsKindScreen() {
  const {
    kind: kindParam,
    course: courseKey,
    week: weekParam,
  } = useLocalSearchParams<{ kind: string; course?: string; week?: string }>();
  const kind = isTestKind(kindParam) ? kindParam : null;
  const week = Number(weekParam ?? NO_WEEK);

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
  const weekLabel = week === NO_WEEK ? "주차 미지정" : `${week}주차`;
  const tests =
    course && kind ? testsOfWeek(course, week).filter((t) => t.kind === kind) : [];

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
          <Text className="mt-6 text-base font-bold text-ink-soft">{weekLabel}</Text>
          {tests.length === 0 ? (
            <EmptyState
              icon="document-text-outline"
              title={`이 주차에는 ${title} 시험이 없어요`}
              description="강사님이 시험을 등록하면 여기에 나타나요"
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
