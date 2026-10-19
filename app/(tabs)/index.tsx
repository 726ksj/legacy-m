import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import {
  fetchWeeklyCourses,
  KIND_LABEL,
  summarizeWeekly,
  weekDeadline,
  type WeeklyCourse,
  type WeeklySummary,
  type WeeklyTask,
} from "../../lib/weekly";
import { fetchHomeStats, type HomeStats } from "../../lib/homeStats";
import { categoryColors, colors } from "../../lib/theme";
import ScreenHeader from "../../components/ScreenHeader";

interface CourseTask {
  task: WeeklyTask;
  course: WeeklyCourse;
}

// 바로 이어서 할 시험: 진행 중 > 지각/기한 초과로 못 끝낸 시험 > 이번 주 미응시.
function pickNext(items: CourseTask[]): { item: CourseTask; label: string } | null {
  const open = items.filter(({ task }) => task.status !== "completed");
  const inProgress = open.find(({ task }) => task.status === "in_progress");
  if (inProgress) return { item: inProgress, label: "이어서 하기" };
  const late = open.find(({ task }) => task.is_late || task.is_overdue);
  if (late) return { item: late, label: "지난 주 시험 응시하기" };
  const next = open[0];
  return next ? { item: next, label: "다음 시험" } : null;
}

export default function HomeScreen() {
  const [name, setName] = useState<string | null>(null);
  const [weekly, setWeekly] = useState<WeeklySummary>({
    total: 0,
    done: 0,
    lateCount: 0,
    overdueCount: 0,
  });
  const [courses, setCourses] = useState<WeeklyCourse[]>([]);
  const [stats, setStats] = useState<HomeStats | null>(null);
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

    const [{ data: profile }, weeklyCourses, homeStats] = await Promise.all([
      supabase
        .from("profiles")
        .select("name")
        .eq("id", session.user.id)
        .single(),
      // 이번 주 요약을 못 불러와도 홈 화면 전체가 멈추지 않게 빈 목록으로 대체한다.
      fetchWeeklyCourses().catch(() => [] as WeeklyCourse[]),
      // 연속 학습일·성적 요약을 못 불러와도 홈 화면은 계속 보이게 한다.
      fetchHomeStats().catch(() => null),
    ]);

    setStats(homeStats);
    setName(profile?.name ?? null);
    setCourses(weeklyCourses);
    setWeekly(summarizeWeekly(weeklyCourses));
  }, []);

  // 시험을 마치고 돌아올 때마다 요약을 다시 불러온다.
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

  // 이번 주(현재 주차) 시험 중 끝낸 비율. 지난 주 미완료(지각·기한 초과)는 따로 센다.
  const progressPct =
    weekly.total === 0 ? 0 : Math.round((weekly.done / weekly.total) * 100);

  const allTasks: CourseTask[] = courses.flatMap((course) =>
    course.tasks.map((task) => ({ task, course })),
  );
  const next = pickNext(allTasks);
  // 이번 주 마감이 임박한(하루 이내) 미완료 시험.
  const urgentTasks = allTasks.filter(
    ({ task, course }) =>
      task.status !== "completed" &&
      !task.is_late &&
      !task.is_overdue &&
      weekDeadline(course)?.urgent,
  );
  const urgentLabel = urgentTasks[0] ? weekDeadline(urgentTasks[0].course)?.label : null;
  const scoreDelta =
    stats && stats.average !== null && stats.previousAverage !== null
      ? stats.average - stats.previousAverage
      : null;
  // 진행 중인 단어 시험이 있으면 안 푼 문제로 바로 들어가고, 없으면 시험 화면(회차 선택)으로 간다.
  const openNext = async ({ task }: CourseTask) => {
    if (task.kind === "writing") {
      router.push(`/writing/${task.id}`);
      return;
    }
    const { data } = await supabase
      .from("vocab_test_attempts")
      .select("id")
      .eq("vocab_set_id", task.id)
      .eq("status", "in_progress")
      .limit(1)
      .maybeSingle();
    router.push(data ? `/attempt/${data.id}` : `/test/${task.id}`);
  };

  if (loading) {
    return (
      <View className="flex-1 bg-blush">
        <ScreenHeader title="LEGACY M" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brand} />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-blush">
      <ScreenHeader
        title="LEGACY M"
        right={
          <Pressable
            onPress={() => Alert.alert("알림", "새 알림이 없습니다.")}
            hitSlop={8}
            className="h-9 w-9 items-center justify-center rounded-full bg-white/25"
          >
            <Ionicons name="notifications-outline" size={20} color="white" />
          </Pressable>
        }
      />

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
        <Text className="mt-6 text-3xl font-extrabold text-ink">
          안녕하세요, {name ?? "회원"}님
        </Text>
        <Text className="mt-1 text-base text-ink-soft">
          이번 주 학습을 이어가 볼까요?
        </Text>

        {/* 이어서 할 시험 하나를 바로 연다. */}
        {next && (
          <Pressable
            onPress={() => openNext(next.item)}
            style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
            className="mt-6 flex-row items-center justify-between rounded-3xl bg-brand px-6 py-5 shadow-md shadow-brand/40"
          >
            <View className="flex-1 pr-3">
              <Text className="text-sm font-bold text-white/80">
                {next.label}
              </Text>
              <Text className="mt-1 text-xl font-extrabold text-white">
                {next.item.task.title}
              </Text>
              <Text className="mt-1 text-sm text-white/80">
                {KIND_LABEL[next.item.task.kind]}
                {next.item.task.week !== null
                  ? ` · ${next.item.task.week}주차`
                  : ""}
              </Text>
            </View>
            <Ionicons name="play-circle" size={44} color="white" />
          </Pressable>
        )}

        {/* 이번 주 마감이 임박한 시험과 지각 응시 가능한 시험을 한 줄로 알린다. */}
        {(urgentTasks.length > 0 || weekly.lateCount > 0) && (
          <Pressable
            onPress={() => router.push("/study")}
            className="mt-4 flex-row items-center rounded-2xl bg-amber-50 px-4 py-3 active:opacity-80"
          >
            <Ionicons name="alarm-outline" size={20} color="#b45309" />
            <View className="ml-3 flex-1">
              {urgentTasks.length > 0 && (
                <Text className="text-sm font-bold text-amber-800">
                  마감 {urgentLabel === "오늘 마감" ? "오늘" : urgentLabel} · 아직 못 푼 시험{" "}
                  {urgentTasks.length}개
                </Text>
              )}
              {weekly.lateCount > 0 && (
                <Text className="text-sm font-bold text-amber-800">
                  지난 주 시험 {weekly.lateCount}개를 지각 응시할 수 있어요
                </Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={18} color="#b45309" />
          </Pressable>
        )}

        {/* 박스 전체를 누르면 학습 탭(이번 주 시험 목록)으로 이동한다. */}
        <Pressable
          onPress={() => router.push("/study")}
          style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
          className="mt-4 rounded-3xl border border-line bg-white px-6 py-6 shadow-sm shadow-brand/20"
        >
          <View className="flex-row items-center justify-between">
            <Text className="text-xl font-bold text-ink">이번 주 진행률</Text>
            <View className="flex-row items-center gap-1">
              <Text className="text-2xl font-extrabold text-berry">
                {progressPct}%
              </Text>
              <Ionicons
                name="chevron-forward"
                size={22}
                color={colors.inkMuted}
              />
            </View>
          </View>
          <View className="mt-4 h-3 w-full rounded-full bg-blush">
            <View
              className="h-3 rounded-full bg-brand"
              style={{ width: `${progressPct}%` }}
            />
          </View>
          <Text className="mt-4 text-base text-ink-soft">
            {weekly.total === 0
              ? "이번 주 할 일이 없어요"
              : `이번 주 시험 ${weekly.total}개 중 ${weekly.done}개 완료`}
            {weekly.lateCount > 0 ? ` · 지각 응시 ${weekly.lateCount}개` : ""}
            {weekly.overdueCount > 0
              ? ` · 기한 초과 ${weekly.overdueCount}개`
              : ""}
          </Text>
        </Pressable>

        {/* 연속 학습일과 오늘 푼 문제 수. */}
        {stats && (
          <View className="mt-4 flex-row items-center rounded-3xl border border-line bg-white px-5 py-4 shadow-sm shadow-brand/20">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-cream">
              <Ionicons name="flame" size={26} color={colors.brandDark} />
            </View>
            <View className="ml-4 flex-1">
              <Text className="text-lg font-extrabold text-ink">
                {stats.streak > 0
                  ? `${stats.streak}일 연속 학습 중`
                  : "오늘 학습을 시작해 보세요"}
              </Text>
              <Text className="mt-0.5 text-sm text-ink-soft">
                {stats.streak > 0 && !stats.studiedToday
                  ? "오늘 학습하면 연속 기록이 이어져요"
                  : `오늘 푼 문제 ${stats.solvedToday}개`}
              </Text>
            </View>
          </View>
        )}

        {/* 최근 시험 점수 3개와 평균 변화. 누르면 학습 결과로 이동한다. */}
        {stats && stats.recent.length > 0 && (
          <Pressable
            onPress={() => router.push("/results")}
            className="mt-4 rounded-3xl border border-line bg-white px-5 py-5 shadow-sm shadow-brand/20 active:opacity-90"
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-bold text-ink">내 성적</Text>
              <View className="flex-row items-center gap-2">
                <Text className="text-base font-extrabold text-berry">
                  평균 {stats.average}점
                </Text>
                {scoreDelta !== null && scoreDelta !== 0 && (
                  <Text
                    className={`text-sm font-bold ${
                      scoreDelta > 0 ? "text-emerald-600" : "text-red-500"
                    }`}
                  >
                    {scoreDelta > 0 ? "▲" : "▼"} {Math.abs(scoreDelta)}
                  </Text>
                )}
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.inkMuted}
                />
              </View>
            </View>
            <View className="mt-3 gap-2">
              {stats.recent.map((item) => {
                const palette = categoryColors[item.kind];
                return (
                  <View
                    key={item.key}
                    className="flex-row items-center justify-between"
                  >
                    <View className="flex-1 flex-row items-center gap-2">
                      <View
                        className="rounded-full px-2 py-0.5"
                        style={{ backgroundColor: palette.accent }}
                      >
                        <Text
                          className="text-xs font-bold"
                          style={{ color: palette.fg }}
                        >
                          {KIND_LABEL[item.kind]}
                        </Text>
                      </View>
                      <Text
                        className="flex-1 text-base text-ink"
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                    </View>
                    <Text
                      className="text-base font-extrabold"
                      style={{ color: palette.fg }}
                    >
                      {item.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}
