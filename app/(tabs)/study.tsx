import { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, View } from "react-native";
import { Text } from "../../components/AppText";
import { router, useFocusEffect } from "expo-router";
import { supabase } from "../../lib/supabase";
import { fetchVocabOverview } from "../../lib/vocab";
import { fetchVocabStatuses } from "../../lib/progress";
import {
  fetchWeeklyCourses,
  type TestKind,
  type WeeklyCourse,
  type WeeklyTask,
} from "../../lib/weekly";
import { categoryColors, colors } from "../../lib/theme";
import ScreenHeader from "../../components/ScreenHeader";
import TaskRow from "../../components/TaskRow";

interface StudyItem {
  task: WeeklyTask;
  course: WeeklyCourse | null;
}

const SECTIONS = [
  { kind: "vocab", title: "단어 학습", empty: "응시할 단어 시험이 없어요" },
  { kind: "writing", title: "어순 배열", empty: "응시할 어순 배열이 없어요" },
  { kind: "order", title: "순서 배열", empty: "응시할 순서 배열이 없어요" },
  { kind: "sentence", title: "문장 배열", empty: "응시할 문장 배열이 없어요" },
] as const;

// 학습 유형 한 칸: 이번 주 시험을 앞에, 지난 주에 못 끝낸 시험을 뒤에 한 줄씩 나열한다.
function Section({
  kind,
  title,
  empty,
  items,
}: {
  kind: TestKind;
  title: string;
  empty: string;
  items: StudyItem[];
}) {
  const palette = categoryColors[kind];
  const ordered = [
    ...items.filter(({ task }) => !task.is_late && !task.is_overdue),
    ...items.filter(({ task }) => task.is_late || task.is_overdue),
  ];

  return (
    <View className="mt-8 gap-3">
      <Text className="text-2xl font-extrabold" style={{ color: palette.fg }}>
        {title}
      </Text>

      {ordered.length === 0 && (
        <View className="rounded-3xl border border-line bg-white px-6 py-6">
          <Text className="text-lg text-ink-soft">{empty}</Text>
        </View>
      )}

      {ordered.map(({ task }) => (
        <TaskRow key={`${task.kind}:${task.id}`} task={task} />
      ))}
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

      </ScrollView>
    </View>
  );
}
