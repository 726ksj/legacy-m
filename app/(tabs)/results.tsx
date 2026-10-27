import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { Text } from "../../components/AppText";
import { router, useFocusEffect } from "expo-router";
import { supabase } from "../../lib/supabase";
import { colors } from "../../lib/theme";
import {
  fetchCourseResults,
  NO_WEEK,
  testsOfWeek,
  type CourseResults,
} from "../../lib/results";
import { KINDS } from "../../lib/study";
import ScreenHeader from "../../components/ScreenHeader";
import EmptyState from "../../components/EmptyState";
import KindCard from "../../components/KindCard";

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-full border px-3.5 py-1.5 ${
        selected ? "border-brand bg-brand" : "border-line bg-white"
      }`}
    >
      <Text
        className={`text-sm font-bold ${selected ? "text-white" : "text-ink-soft"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// 처음 보여 줄 주차: 이번 주차. 모르거나 범위를 벗어나면 시험이 있는 가장 최근 주차.
function defaultWeek(course: CourseResults): number {
  const { currentWeek, totalWeeks } = course;
  if (currentWeek !== null && currentWeek >= 1 && currentWeek <= totalWeeks) {
    return currentWeek;
  }
  const withTests = course.tests
    .map((t) => t.week)
    .filter((w): w is number => w !== null);
  if (currentWeek !== null && currentWeek > totalWeeks && totalWeeks >= 1) {
    return totalWeeks;
  }
  return withTests.length > 0 ? Math.max(...withTests) : 1;
}

// 학습 결과 허브: 주차를 고르고, 학습처럼 유형 카드를 눌러 그 주차의 결과를 본다.
export default function ResultsScreen() {
  const [courses, setCourses] = useState<CourseResults[]>([]);
  const [courseKey, setCourseKey] = useState<string | null>(null);
  const [week, setWeek] = useState<number | null>(null);
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

  // 강좌 선택(첫 강좌가 기본)과 그 강좌의 기본 주차(이번 주)를 정한다.
  const course = useMemo(
    () => courses.find((c) => c.key === courseKey) ?? courses[0] ?? null,
    [courses, courseKey],
  );
  useEffect(() => {
    if (course) setWeek((prev) => prev ?? defaultWeek(course));
  }, [course]);

  const selectCourse = (c: CourseResults) => {
    setCourseKey(c.key);
    setWeek(defaultWeek(c));
  };

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

  const weeks = course
    ? Array.from({ length: course.totalWeeks }, (_, i) => i + 1)
    : [];
  const hasNoWeek = course ? testsOfWeek(course, NO_WEEK).length > 0 : false;
  const selectedWeek = week ?? (course ? defaultWeek(course) : 1);
  const tests = course ? testsOfWeek(course, selectedWeek) : [];

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
        {!course ? (
          <EmptyState
            icon="stats-chart-outline"
            title="아직 학습 기록이 없어요"
            description="수강 중인 강좌의 주차별 결과가 여기에 쌓여요"
          />
        ) : (
          <>
            {courses.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mt-5"
              >
                <View className="flex-row gap-2">
                  {courses.map((c) => (
                    <Chip
                      key={c.key}
                      label={c.label}
                      selected={c.key === course.key}
                      onPress={() => selectCourse(c)}
                    />
                  ))}
                </View>
              </ScrollView>
            )}

            {/* 학습 화면의 안내 문구 자리: 지금 선택된 주차(기본은 이번 주)를 칩으로 보여 주고 바꿀 수 있다. */}
            {/* 높이를 h-10으로 고정해 학습 화면의 안내 문구 줄과 같게 한다(아래 카드 위치가 같아진다). */}
            <View className={`${courses.length > 1 ? "mt-4" : "mt-6"} h-10 justify-center`}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="flex-grow-0"
              >
                <View className="flex-row gap-2">
                  {weeks.map((w) => (
                    <Chip
                      key={w}
                      label={`${w}주차`}
                      selected={selectedWeek === w}
                      onPress={() => setWeek(w)}
                    />
                  ))}
                  {hasNoWeek && (
                    <Chip
                      label="주차 미지정"
                      selected={selectedWeek === NO_WEEK}
                      onPress={() => setWeek(NO_WEEK)}
                    />
                  )}
                </View>
              </ScrollView>
            </View>

            <View className="mt-4 gap-4">
              {[KINDS.slice(0, 2), KINDS.slice(2, 4)].map((row) => (
                <View key={row[0]} className="flex-row gap-4">
                  {row.map((kind) => {
                    // 결과는 응시한 시험만 센다(아직 안 본 시험은 학습 화면에서 본다).
                    const count = tests.filter(
                      (t) => t.kind === kind && t.status !== "not_started",
                    ).length;
                    return (
                      <KindCard
                        key={kind}
                        kind={kind}
                        subtitle={count > 0 ? `시험 ${count}개` : "응시한 시험 없음"}
                        onPress={() =>
                          router.push(
                            `/week-results/${kind}?course=${encodeURIComponent(course.key)}&week=${selectedWeek}` as never,
                          )
                        }
                      />
                    );
                  })}
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
