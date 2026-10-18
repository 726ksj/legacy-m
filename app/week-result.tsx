import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { supabase } from "../lib/supabase";
import { categoryColors, colors } from "../lib/theme";
import {
  fetchCourseResults,
  NO_WEEK,
  testsOfWeek,
  weekRange,
  type CourseResults,
  type WeekTest,
} from "../lib/results";
import { KIND_LABEL } from "../lib/weekly";
import ScreenHeader from "../components/ScreenHeader";
import EmptyState from "../components/EmptyState";
import StatusChip from "../components/StatusChip";

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

// 그 주차에 본(또는 아직 못 본) 시험 하나. 누르면 해당 시험 화면으로 간다.
function TestResultCard({ test }: { test: WeekTest }) {
  const palette = categoryColors[test.kind];
  const done = test.status === "completed";

  return (
    <Pressable
      onPress={() =>
        router.push(
          test.kind === "vocab" ? `/test/${test.id}` : `/writing/${test.id}`,
        )
      }
      style={{
        backgroundColor: palette.bg,
        borderWidth: 1,
        borderColor: palette.border,
      }}
      className="rounded-3xl px-5 py-4 active:opacity-80"
    >
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1 flex-row items-center gap-2">
          <View
            className="rounded-full px-2.5 py-0.5"
            style={{ backgroundColor: palette.accent }}
          >
            <Text className="text-sm font-bold" style={{ color: palette.fg }}>
              {KIND_LABEL[test.kind]}
            </Text>
          </View>
          <Text className="flex-1 text-lg font-bold text-ink">{test.title}</Text>
        </View>
        {done && test.scoreLabel ? (
          <View className="rounded-full bg-white px-3 py-1">
            <Text
              className="text-base font-extrabold"
              style={{ color: palette.fg }}
            >
              {test.scoreLabel}
            </Text>
          </View>
        ) : (
          <StatusChip status={test.status} />
        )}
      </View>
      <View className="mt-1.5 flex-row flex-wrap items-center gap-2">
        {done && test.detail && test.date && (
          <Text className="text-sm text-ink-soft">
            {test.detail} · {formatDate(test.date)}
          </Text>
        )}
        {!done && (
          <Text className="text-sm text-ink-soft">
            {test.status === "in_progress"
              ? "이어서 풀 수 있어요"
              : "아직 응시하지 않았어요"}
          </Text>
        )}
        {test.timings.map((tag) => (
          <View
            key={tag.label}
            className={`rounded-full px-2 py-0.5 ${
              tag.kind === "overdue" ? "bg-red-100" : "bg-amber-100"
            }`}
          >
            <Text
              className={`text-[12px] font-bold ${
                tag.kind === "overdue" ? "text-red-600" : "text-amber-700"
              }`}
            >
              {tag.label}
            </Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

// 학습 결과 > 주차: 선택한 주차에 속한 시험들의 결과.
export default function WeekResultScreen() {
  const { course: courseKey, week: weekParam } = useLocalSearchParams<{
    course: string;
    week: string;
  }>();
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
    const all = await fetchCourseResults().catch(() => []);
    setCourse(all.find((c) => c.key === courseKey) ?? null);
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

  const tests = course ? testsOfWeek(course, week) : [];
  const range = course && week !== NO_WEEK ? weekRange(course.startDate, week) : null;

  return (
    <View className="flex-1 bg-blush">
      <ScreenHeader
        title={week === NO_WEEK ? "주차 미지정" : `${week}주차 결과`}
        back
      />
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : (
        <ScrollView
          contentContainerClassName="px-6 py-6 gap-3"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.brand}
            />
          }
        >
          {course && (
            <View className="mb-1">
              <Text className="text-base font-bold text-ink-soft">
                {course.label}
              </Text>
              {range && (
                <Text className="mt-0.5 text-sm text-ink-soft">{range}</Text>
              )}
            </View>
          )}

          {tests.length === 0 ? (
            <EmptyState
              icon="document-text-outline"
              title="이 주차에는 시험이 없어요"
              description="강사님이 시험을 등록하면 여기에 나타나요"
            />
          ) : (
            tests.map((test) => (
              <TestResultCard key={`${test.kind}:${test.id}`} test={test} />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}
