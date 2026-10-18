import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
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
import { listWrongNotes } from "../../lib/wrongNotes";
import { categoryColors, colors } from "../../lib/theme";
import ScreenHeader from "../../components/ScreenHeader";
import TaskRow from "../../components/TaskRow";

// 홈 목록에 바로 보여 주는 이번 주 시험 개수. 나머지는 "전체 보기"로 본다.
const WEEK_PREVIEW = 4;

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
  // 오답노트에서 아직 마스터하지 못한(복습할) 단어 수. 불러오지 못하면 null.
  const [wrongActive, setWrongActive] = useState<number | null>(null);
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

    const [{ data: profile }, weeklyCourses, notes] = await Promise.all([
      supabase
        .from("profiles")
        .select("name")
        .eq("id", session.user.id)
        .single(),
      // 이번 주 요약을 못 불러와도 홈 화면 전체가 멈추지 않게 빈 목록으로 대체한다.
      fetchWeeklyCourses().catch(() => [] as WeeklyCourse[]),
      // 오답노트를 못 불러와도 홈 전체가 멈추지 않게 한다.
      listWrongNotes().catch(() => null),
    ]);

    setName(profile?.name ?? null);
    setCourses(weeklyCourses);
    setWeekly(summarizeWeekly(weeklyCourses));
    setWrongActive(
      notes ? notes.filter((note) => note.status === "active").length : null,
    );
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

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
  const thisWeekTasks = allTasks.filter(
    ({ task }) => !task.is_late && !task.is_overdue,
  );
  const previewTasks = thisWeekTasks.slice(0, WEEK_PREVIEW);
  const hiddenCount = thisWeekTasks.length - previewTasks.length;
  const openNext = ({ task }: CourseTask) =>
    router.push(
      task.kind === "vocab" ? `/test/${task.id}` : `/writing/${task.id}`,
    );

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

        {/* 박스 전체를 누르면 이번 주에 응시해야 할 시험 목록(이번 주 할 일)으로 이동한다. */}
        <Pressable
          onPress={() => router.push("/week")}
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

        <View className="mb-3 mt-8 flex-row items-center justify-between">
          <Text className="text-base font-bold text-ink-soft">
            이번 주 시험
          </Text>
          <Pressable onPress={() => router.push("/week")} hitSlop={8}>
            <Text className="text-sm font-bold text-brand-dark">
              전체 보기 ›
            </Text>
          </Pressable>
        </View>
        {previewTasks.length === 0 ? (
          <View className="rounded-3xl border border-line bg-white px-5 py-5">
            <Text className="text-base text-ink-soft">
              이번 주 할 일이 없어요
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {previewTasks.map(({ task, course }) => (
              <TaskRow
                key={`${task.kind}:${task.id}`}
                task={task}
                deadline={weekDeadline(course)}
              />
            ))}
            {hiddenCount > 0 && (
              <Pressable
                onPress={() => router.push("/week")}
                className="items-center py-1"
              >
                <Text className="text-sm font-bold text-ink-soft">
                  시험 {hiddenCount}개 더 보기
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {/* 오답노트에서 복습할 단어가 몇 개 남았는지 알려 주고 오답 탭으로 보낸다. */}
        <Pressable
          onPress={() => router.push("/wrong")}
          style={({ pressed }) => ({
            opacity: pressed ? 0.9 : 1,
            backgroundColor: categoryColors.vocab.bg,
            borderWidth: 1,
            borderColor: categoryColors.vocab.border,
          })}
          className="mt-8 flex-row items-center justify-between rounded-3xl px-5 py-4"
        >
          <View className="flex-1 pr-3">
            <Text
              className="text-lg font-bold"
              style={{ color: categoryColors.vocab.fg }}
            >
              오답노트 복습
            </Text>
            <Text className="mt-1 text-sm text-ink-soft">
              {wrongActive === null
                ? "오답노트를 불러오지 못했어요"
                : wrongActive === 0
                  ? "복습할 단어가 없어요"
                  : `복습할 단어 ${wrongActive}개 · 두 번 연속 맞히면 마스터`}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.inkMuted} />
        </Pressable>
      </ScrollView>
    </View>
  );
}
