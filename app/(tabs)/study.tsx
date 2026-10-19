import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { supabase } from "../../lib/supabase";
import { fetchVocabOverview } from "../../lib/vocab";
import { fetchVocabStatuses } from "../../lib/progress";
import {
  fetchWeeklyCourses,
  weekDeadline,
  type WeeklyCourse,
  type WeeklyTask,
} from "../../lib/weekly";
import { categoryColors, colors } from "../../lib/theme";
import ScreenHeader from "../../components/ScreenHeader";
import TaskRow from "../../components/TaskRow";
import { ComingSoonCard } from "../../components/StudyCards";

interface StudyItem {
  task: WeeklyTask;
  course: WeeklyCourse | null;
}

const SECTIONS = [
  { kind: "vocab", title: "단어 학습", empty: "응시할 단어 시험이 없어요" },
  { kind: "writing", title: "어순 배열", empty: "응시할 어순 배열이 없어요" },
] as const;

// 학습 유형 한 칸: 이번 주 시험을 먼저, 지난 주에 못 끝낸 시험(지각·기한 초과)을 아래에 보여 준다.
function Section({
  kind,
  title,
  empty,
  items,
}: {
  kind: "vocab" | "writing";
  title: string;
  empty: string;
  items: StudyItem[];
}) {
  const palette = categoryColors[kind];
  const thisWeek = items.filter(
    ({ task }) => !task.is_late && !task.is_overdue,
  );
  const late = items.filter(({ task }) => task.is_late || task.is_overdue);

  return (
    <View className="mt-8 gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-extrabold" style={{ color: palette.fg }}>
          {title}
        </Text>
        <View
          className="rounded-full px-2.5 py-0.5"
          style={{ backgroundColor: palette.accent }}
        >
          <Text className="text-sm font-bold" style={{ color: palette.fg }}>
            {items.length}개
          </Text>
        </View>
      </View>

      {items.length === 0 && (
        <View className="rounded-3xl border border-line bg-white px-5 py-5">
          <Text className="text-base text-ink-soft">{empty}</Text>
        </View>
      )}

      {thisWeek.map(({ task, course }) => (
        <TaskRow
          key={`${task.kind}:${task.id}`}
          task={task}
          deadline={course ? weekDeadline(course) : null}
        />
      ))}

      {late.length > 0 && (
        <>
          <Text className="mt-1 text-sm font-bold text-amber-700">
            지난 주 시험 · 지각 응시 / 기한 초과
          </Text>
          {late.map(({ task }) => (
            <TaskRow key={`${task.kind}:${task.id}`} task={task} />
          ))}
        </>
      )}
    </View>
  );
}

export default function StudyScreen() {
  const [items, setItems] = useState<StudyItem[]>([]);
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
      const [courses, statuses, overview] = await Promise.all([
        fetchWeeklyCourses(),
        // 모든 회차를 마친 단어장은 학습에서 빠지고 학습 결과로 넘어간다.
        fetchVocabStatuses(),
        // 강좌 없이 개인에게 배정된 단어장도 학습에 함께 보여 준다.
        fetchVocabOverview(),
      ]);

      const fromCourses: StudyItem[] = courses.flatMap((course) =>
        course.tasks.map((task) => ({ task, course })),
      );
      const personal: StudyItem[] = overview.groups
        .filter((group) => group.key === "personal")
        .flatMap((group) => group.sets)
        .map((set) => ({
          course: null,
          task: {
            kind: "vocab" as const,
            id: set.id,
            title: set.title,
            week: set.week,
            status: statuses.get(set.id) ?? "not_started",
            is_late: false,
            is_overdue: false,
          },
        }));

      setItems(
        [...fromCourses, ...personal].filter(({ task }) =>
          task.kind === "vocab"
            ? statuses.get(task.id) !== "completed"
            : task.status !== "completed",
        ),
      );
    } catch {
      setError("학습 목록을 불러오지 못했어요.");
    }
  }, []);

  // 시험을 마치고 돌아올 때마다 목록을 다시 불러온다.
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
        <ScreenHeader title="학습" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brand} />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-blush">
      <ScreenHeader title="학습" />
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
        {error && (
          <View className="mt-6 rounded-xl bg-red-50 px-4 py-3">
            <Text className="text-base font-semibold text-red-500">
              {error}
            </Text>
          </View>
        )}

        {SECTIONS.map((section) => (
          <Section
            key={section.kind}
            kind={section.kind}
            title={section.title}
            empty={section.empty}
            items={items.filter(({ task }) => task.kind === section.kind)}
          />
        ))}

        <View className="mt-8 gap-3">
          <ComingSoonCard
            title="순서 배열"
            subtitle="지문과 문장의 순서를 맞춰요"
            colors={categoryColors.order}
          />
          <ComingSoonCard
            title="어법 학습"
            subtitle="문맥에 맞는 어법을 선택해요"
            colors={categoryColors.grammar}
          />
        </View>

        <Text className="mt-6 text-center text-sm text-ink-soft">
          마친 시험은 학습 결과에서 볼 수 있어요
        </Text>
      </ScrollView>
    </View>
  );
}
