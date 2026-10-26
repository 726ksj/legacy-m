import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { Text } from "../../components/AppText";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import {
  fetchMemorizeSets,
  fetchStudyItems,
  isTestKind,
  KIND_TITLES,
  type MemorizeSet,
  type StudyItem,
} from "../../lib/study";
import { testRoute, type WeeklyTask } from "../../lib/weekly";
import { categoryColors, colors } from "../../lib/theme";
import ScreenHeader from "../../components/ScreenHeader";

const KIND_ICON = {
  vocab: "book",
  writing: "reorder-three",
  order: "swap-vertical",
  sentence: "chatbox-ellipses",
} as const;

// 처음 보여 주는 주차 수. 응시할 시험이 남은 주차는 항상 보이고, 나머지는 "더 보기"로 펼친다.
const VISIBLE_WEEKS = 2;

// 암기와 시험을 세트로 묶은 한 줄: 단어장 하나 = 암기 + 그 단어장의 시험.
// task가 null이면 시험을 이미 끝낸 것(학습 결과로 넘어감).
interface Entry {
  id: string;
  title: string;
  week: number | null;
  task: WeeklyTask | null;
  canMemorize: boolean;
}

// 학습 유형 화면: 요약 카드 아래에 주차별로 [암기 + 시험] 세트를 나열한다.
// 암기 화면은 지금 단어(VOCA)에만 있고, 나머지 유형은 시험만 있다.
export default function LearnKindScreen() {
  const { kind: kindParam } = useLocalSearchParams<{ kind: string }>();
  const kind = isTestKind(kindParam) ? kindParam : null;

  const [tests, setTests] = useState<StudyItem[]>([]);
  const [memorize, setMemorize] = useState<MemorizeSet[]>([]);
  const [showAllWeeks, setShowAllWeeks] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!kind) return;
    setError(null);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.replace("/login");
      return;
    }

    try {
      const [items, sets] = await Promise.all([
        fetchStudyItems(),
        kind === "vocab" ? fetchMemorizeSets() : Promise.resolve([]),
      ]);
      setTests(items.filter(({ task }) => task.kind === kind));
      setMemorize(sets);
    } catch {
      setError("학습 목록을 불러오지 못했어요.");
    }
  }, [kind]);

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

  const entries = useMemo<Entry[]>(() => {
    const taskById = new Map(tests.map(({ task }) => [task.id, task]));
    const list: Entry[] = memorize.map((set) => ({
      id: set.id,
      title: set.title,
      week: set.week,
      task: taskById.get(set.id) ?? null,
      canMemorize: true,
    }));
    // 암기 목록에 없는 시험(단어 외 유형 포함)도 빠짐없이 넣는다.
    const known = new Set(list.map((e) => e.id));
    for (const { task } of tests) {
      if (!known.has(task.id)) {
        list.push({ id: task.id, title: task.title, week: task.week, task, canMemorize: false });
      }
    }
    return list;
  }, [tests, memorize]);

  // 최신 주차부터 주차별로 묶는다(주차 없는 것은 맨 뒤).
  const weekGroups = useMemo(() => {
    const byWeek = new Map<number | null, Entry[]>();
    for (const entry of entries) {
      byWeek.set(entry.week, [...(byWeek.get(entry.week) ?? []), entry]);
    }
    return [...byWeek.entries()].sort(([a], [b]) => {
      if (a === null) return 1;
      if (b === null) return -1;
      return b - a;
    });
  }, [entries]);

  if (!kind) {
    return (
      <View className="flex-1 bg-blush">
        <ScreenHeader title="학습" back />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-lg text-ink-soft">알 수 없는 학습 유형이에요.</Text>
        </View>
      </View>
    );
  }

  const title = KIND_TITLES[kind];

  if (loading) {
    return (
      <View className="flex-1 bg-blush">
        <ScreenHeader title={title} back />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brand} />
        </View>
      </View>
    );
  }

  const visibleGroups = showAllWeeks
    ? weekGroups
    : weekGroups.filter(
        ([, group], i) => i < VISIBLE_WEEKS || group.some((entry) => entry.task !== null),
      );
  const hiddenWeeks = weekGroups.length - visibleGroups.length;

  return (
    <View className="flex-1 bg-blush">
      <ScreenHeader title={title} back />
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
            <Text className="text-base font-semibold text-red-500">{error}</Text>
          </View>
        )}

        <View className="mt-6 gap-6">          {entries.length === 0 && (
            <View className="items-center rounded-3xl border border-line bg-white px-6 py-10">
              <Ionicons name="checkmark-circle-outline" size={34} color={colors.inkMuted} />
              <Text className="mt-3 text-lg text-ink-soft">아직 올라온 학습이 없어요</Text>
            </View>
          )}
          {visibleGroups.map(([week, group]) => (
            <View key={week ?? "none"} className="gap-3">
              <Text className="px-1 text-base font-bold text-ink-soft">
                {week !== null ? `${week}주차` : "주차 미지정"}
              </Text>
              {group.map((entry) => (
                <EntryCard key={entry.id} entry={entry} kind={kind} />
              ))}
            </View>
          ))}
          {hiddenWeeks > 0 && (
            <Pressable
              onPress={() => setShowAllWeeks(true)}
              className="flex-row items-center justify-center gap-1 rounded-2xl border border-line bg-white py-3.5"
            >
              <Text className="text-base font-bold text-ink-soft">
                이전 주차 {hiddenWeeks}개 더 보기
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.inkSoft} />
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// 세트 카드: 제목 + 상태 뱃지, 아래에 [암기] [시험] 버튼.
function EntryCard({ entry, kind }: { entry: Entry; kind: keyof typeof categoryColors }) {
  const palette = categoryColors[kind];
  const { task } = entry;
  const badge = task?.is_overdue
    ? { label: "기한 초과", fg: "#b91c1c", bg: "#fee2e2" }
    : task?.is_late
      ? { label: "지각 응시", fg: "#c2410c", bg: "#ffedd5" }
      : task?.status === "in_progress"
        ? { label: "진행 중", fg: palette.fg, bg: palette.accent }
        : undefined;
  const testLabel = !task ? "시험 완료" : task.status === "in_progress" ? "이어서 하기" : "시험 보기";

  return (
    <View className="rounded-3xl border border-line bg-white p-4">
      <View className="flex-row items-center">
        <View
          className="h-11 w-11 items-center justify-center rounded-xl"
          style={{ backgroundColor: palette.bg }}
        >
          <Ionicons name={KIND_ICON[kind]} size={22} color={palette.fg} />
        </View>
        <Text className="ml-3 flex-1 text-lg font-bold text-ink" numberOfLines={2}>
          {entry.title}
        </Text>
        {badge && (
          <View className="ml-2 rounded-full px-2.5 py-1" style={{ backgroundColor: badge.bg }}>
            <Text className="text-xs font-bold" style={{ color: badge.fg }}>
              {badge.label}
            </Text>
          </View>
        )}
      </View>

      <View className="mt-4 flex-row gap-2.5">
        {entry.canMemorize && (
          <Pressable
            onPress={() => router.push(`/memorize/${entry.id}`)}
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-2xl py-3.5 active:opacity-80"
            style={{ backgroundColor: palette.bg, borderWidth: 1, borderColor: palette.border }}
          >
            <Ionicons name="reader-outline" size={18} color={palette.fg} />
            <Text className="text-base font-bold" style={{ color: palette.fg }}>
              암기
            </Text>
          </Pressable>
        )}
        <Pressable
          disabled={!task}
          onPress={() => task && router.push(testRoute(task.kind, task.id))}
          className="flex-1 flex-row items-center justify-center gap-1.5 rounded-2xl py-3.5 active:opacity-80"
          style={{ backgroundColor: task ? palette.fg : "#ece6e9" }}
        >
          <Ionicons
            name={task ? "create-outline" : "checkmark-circle"}
            size={18}
            color={task ? "#ffffff" : colors.inkMuted}
          />
          <Text
            className="text-base font-bold"
            style={{ color: task ? "#ffffff" : colors.inkMuted }}
          >
            {testLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
