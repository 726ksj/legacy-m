import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { supabase } from "../lib/supabase";
import { colors } from "../lib/theme";
import { fetchWeeklyCourses, type WeeklyCourse } from "../lib/weekly";
import TaskRow from "../components/TaskRow";
import EmptyState from "../components/EmptyState";
import ScreenHeader from "../components/ScreenHeader";

export default function WeeklyTasksScreen() {
  const [courses, setCourses] = useState<WeeklyCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
      setCourses(await fetchWeeklyCourses());
    } catch {
      setError("이번 주 할 일을 불러오지 못했어요.");
    }
  }, []);

  // 시험을 마치고 돌아올 때마다 진행 상태를 다시 불러온다.
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

  const visible = courses.filter((course) => course.tasks.length > 0);

  return (
    <View className="flex-1 bg-blush">
      <ScreenHeader title="이번 주 할 일" back />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-6 py-6 gap-8"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.brand}
            />
          }
        >
          {error && (
            <View className="rounded-xl bg-red-50 px-4 py-3">
              <Text className="text-base font-semibold text-red-500">
                {error}
              </Text>
            </View>
          )}

          {!error && visible.length === 0 && (
            <EmptyState
              icon="checkmark-done-outline"
              title="이번 주 할 일이 없어요"
              description="새 시험이 등록되면 여기에 나타나요"
            />
          )}

          {visible.map((course) => {
            const thisWeek = course.tasks.filter(
              (task) => !task.is_late && !task.is_overdue,
            );
            const late = course.tasks.filter(
              (task) => task.is_late || task.is_overdue,
            );
            return (
              <View key={course.course_id} className="gap-3">
                <View className="flex-row items-center justify-between">
                  <Text className="flex-1 text-base font-bold text-ink-soft">
                    [{course.subject}] {course.title}
                  </Text>
                  {course.current_week !== null && course.current_week >= 1 && (
                    <View className="rounded-full bg-brand px-2.5 py-0.5">
                      <Text className="text-[13px] font-bold text-white">
                        {course.current_week}주차
                      </Text>
                    </View>
                  )}
                </View>

                {thisWeek.length > 0 && (
                  <View className="gap-3">
                    {thisWeek.map((task) => (
                      <TaskRow key={`${task.kind}:${task.id}`} task={task} />
                    ))}
                  </View>
                )}

                {late.length > 0 && (
                  <View className="mt-2 gap-3">
                    <Text className="text-sm font-bold text-amber-700">
                      지난 주 시험 · 지각 응시 / 기한 초과
                    </Text>
                    {late.map((task) => (
                      <TaskRow key={`${task.kind}:${task.id}`} task={task} />
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
