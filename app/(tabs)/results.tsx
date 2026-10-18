import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { colors } from "../../lib/theme";
import {
  fetchCourseResults,
  NO_WEEK,
  testsOfWeek,
  weekRange,
  type CourseResults,
} from "../../lib/results";
import ScreenHeader from "../../components/ScreenHeader";
import EmptyState from "../../components/EmptyState";

// 강좌 기간(1주차~N주차)을 주차별로 나열한다. 주차를 누르면 그 주에 본 시험의 결과를 본다.
function WeekRow({ course, week }: { course: CourseResults; week: number }) {
  const tests = testsOfWeek(course, week);
  const done = tests.filter((t) => t.status === "completed").length;
  const hasTiming = tests.some((t) => t.timings.length > 0);
  const isCurrent = week === course.currentWeek;
  const notStarted =
    course.currentWeek !== null && week > course.currentWeek && done === 0;
  const range = week === NO_WEEK ? null : weekRange(course.startDate, week);

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/week-result",
          params: { course: course.key, week: String(week) },
        })
      }
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      className={`flex-row items-center justify-between rounded-3xl border px-5 py-4 ${
        isCurrent ? "border-brand bg-white" : "border-line bg-white"
      } ${notStarted ? "opacity-60" : ""}`}
    >
      <View className="flex-1 pr-3">
        <View className="flex-row items-center gap-2">
          <Text className="text-lg font-bold text-ink">
            {week === NO_WEEK ? "주차 미지정" : `${week}주차`}
          </Text>
          {isCurrent && (
            <View className="rounded-full bg-brand px-2 py-0.5">
              <Text className="text-xs font-bold text-white">이번 주</Text>
            </View>
          )}
          {hasTiming && (
            <View className="rounded-full bg-amber-100 px-2 py-0.5">
              <Text className="text-xs font-bold text-amber-700">지각</Text>
            </View>
          )}
        </View>
        <Text className="mt-1 text-sm text-ink-soft">
          {range ? `${range} · ` : ""}
          {tests.length === 0
            ? notStarted
              ? "시작 전"
              : "등록된 시험 없음"
            : `시험 ${tests.length}개 중 ${done}개 완료`}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.inkMuted} />
    </Pressable>
  );
}

export default function ResultsScreen() {
  const [courses, setCourses] = useState<CourseResults[]>([]);
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
    setCourses(await fetchCourseResults().catch(() => []));
  }, []);

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

  if (loading) {
    return (
      <View className="flex-1 bg-blush">
        <ScreenHeader title="학습 결과" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brand} />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-blush">
      <ScreenHeader title="학습 결과" />
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
        {courses.length === 0 && (
          <EmptyState
            icon="stats-chart-outline"
            title="아직 학습 기록이 없어요"
            description="수강 중인 강좌의 주차별 결과가 여기에 쌓여요"
          />
        )}

        {courses.map((course) => {
          // 1주차부터 강사가 설정한 기간까지. 주차가 지정되지 않은 시험은 맨 아래.
          const weeks = Array.from(
            { length: course.totalWeeks },
            (_, i) => i + 1,
          );
          const hasNoWeek = testsOfWeek(course, NO_WEEK).length > 0;
          return (
            <View key={course.key} className="mt-6 gap-3">
              <Text className="text-base font-bold text-ink-soft">
                {course.label}
              </Text>
              {weeks.map((week) => (
                <WeekRow key={week} course={course} week={week} />
              ))}
              {hasNoWeek && <WeekRow course={course} week={NO_WEEK} />}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
