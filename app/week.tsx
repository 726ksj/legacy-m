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
import { supabase } from "../lib/supabase";
import { categoryColors, colors } from "../lib/theme";
import {
  fetchWeeklyCourses,
  KIND_LABEL,
  STATUS_LABEL,
  type WeeklyCourse,
  type WeeklyTask,
} from "../lib/weekly";
import EmptyState from "../components/EmptyState";
import ScreenHeader from "../components/ScreenHeader";

const STATUS_STYLE: Record<WeeklyTask["status"], { bg: string; text: string }> =
  {
    not_started: { bg: "bg-white/80", text: "text-ink-soft" },
    in_progress: { bg: "bg-amber-100", text: "text-amber-700" },
    completed: { bg: "bg-white", text: "text-emerald-600" },
  };

function TaskRow({ task }: { task: WeeklyTask }) {
  const style = STATUS_STYLE[task.status];
  // 단어는 민트, 어순 배열은 분홍으로 구분한다.
  const palette =
    task.kind === "vocab" ? categoryColors.vocab : categoryColors.writing;
  const open = () =>
    router.push(
      task.kind === "vocab" ? `/test/${task.id}` : `/writing/${task.id}`,
    );

  return (
    <Pressable
      onPress={open}
      style={{
        backgroundColor: palette.bg,
        borderWidth: 1,
        borderColor: palette.border,
      }}
      className="rounded-3xl px-5 py-4 active:opacity-80"
    >
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <View
              className="rounded-full px-2.5 py-0.5"
              style={{ backgroundColor: palette.accent }}
            >
              <Text
                className="text-[13px] font-bold"
                style={{ color: palette.fg }}
              >
                {KIND_LABEL[task.kind]}
              </Text>
            </View>
            {task.week !== null && (
              <Text className="text-sm font-semibold text-ink-soft">
                {task.week}주차
              </Text>
            )}
          </View>
          <Text className="mt-1.5 text-lg font-bold text-ink">
            {task.title}
          </Text>
        </View>
        <View className="items-end gap-1.5">
          <View className={`rounded-full px-2.5 py-1 ${style.bg}`}>
            <Text className={`text-sm font-bold ${style.text}`}>
              {STATUS_LABEL[task.status]}
            </Text>
          </View>
          {task.is_late && (
            <View className="rounded-full bg-amber-100 px-2.5 py-0.5">
              <Text className="text-[13px] font-bold text-amber-700">
                지각 응시
              </Text>
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.inkMuted} />
      </View>
    </Pressable>
  );
}

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
            const thisWeek = course.tasks.filter((task) => !task.is_late);
            const late = course.tasks.filter((task) => task.is_late);
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
                      지난 주 시험 · 지각 응시
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
