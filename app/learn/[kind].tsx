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

type Tab = "memorize" | "test";

const KIND_ICON = {
  vocab: "book",
  writing: "reorder-three",
  order: "swap-vertical",
  sentence: "chatbox-ellipses",
} as const;

// 암기 목록에서 처음 보여 주는 주차 수. 나머지는 "이전 주차 더 보기"로 펼친다.
const VISIBLE_WEEKS = 2;

// 학습 유형 화면: 위의 요약과 [암기 | 시험] 탭으로 나눠 보여 준다.
// 암기 화면은 지금 단어(VOCA)에만 있고, 나머지 유형은 준비 중이다.
export default function LearnKindScreen() {
  const { kind: kindParam } = useLocalSearchParams<{ kind: string }>();
  const kind = isTestKind(kindParam) ? kindParam : null;

  const [tests, setTests] = useState<StudyItem[]>([]);
  const [memorize, setMemorize] = useState<MemorizeSet[]>([]);
  const [tab, setTab] = useState<Tab | null>(null);
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
      const mine = items.filter(({ task }) => task.kind === kind);
      setTests(mine);
      setMemorize(sets);
      // 처음 들어올 때만: 응시할 시험이 있으면 시험 탭, 없으면 암기 탭부터 보여 준다.
      setTab((current) => current ?? (mine.length > 0 ? "test" : "memorize"));
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

  // 이번 주 시험, 지난 주에 못 끝낸 시험(지각·기한 초과) 순으로 나눈다.
  const { current, past } = useMemo(
    () => ({
      current: tests.filter(({ task }) => !task.is_late && !task.is_overdue),
      past: tests.filter(({ task }) => task.is_late || task.is_overdue),
    }),
    [tests],
  );

  // 암기 단어장은 최신 주차부터 주차별로 묶는다(주차 없는 것은 맨 뒤).
  const weekGroups = useMemo(() => {
    const byWeek = new Map<number | null, MemorizeSet[]>();
    for (const set of memorize) {
      byWeek.set(set.week, [...(byWeek.get(set.week) ?? []), set]);
    }
    return [...byWeek.entries()].sort(([a], [b]) => {
      if (a === null) return 1;
      if (b === null) return -1;
      return b - a;
    });
  }, [memorize]);

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

  const palette = categoryColors[kind];
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

  const activeTab = tab ?? "test";
  const visibleGroups = showAllWeeks ? weekGroups : weekGroups.slice(0, VISIBLE_WEEKS);
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

        <View
          className="mt-6 flex-row items-center rounded-3xl px-5 py-5"
          style={{ backgroundColor: palette.bg, borderWidth: 1, borderColor: palette.border }}
        >
          <View
            className="h-14 w-14 items-center justify-center rounded-2xl"
            style={{ backgroundColor: palette.accent }}
          >
            <Ionicons name={KIND_ICON[kind]} size={28} color={palette.fg} />
          </View>
          <View className="ml-4 flex-1">
            <Text className="text-lg font-bold text-ink">
              {tests.length > 0 ? `응시할 시험 ${tests.length}개` : "응시할 시험이 없어요"}
            </Text>
            <Text className="mt-0.5 text-base text-ink-soft">
              {past.length > 0
                ? `지난 주에 못 끝낸 시험 ${past.length}개`
                : kind === "vocab"
                  ? `암기할 단어장 ${memorize.length}개`
                  : "차근차근 풀어 보세요"}
            </Text>
          </View>
        </View>

        <View className="mt-5 flex-row rounded-2xl border border-line bg-white p-1">
          {(
            [
              { key: "memorize", label: "암기", count: 0 },
              { key: "test", label: "시험", count: tests.length },
            ] as const
          ).map((item) => {
            const active = activeTab === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setTab(item.key)}
                className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-3"
                style={{ backgroundColor: active ? palette.fg : "transparent" }}
              >
                <Text
                  className="text-base font-bold"
                  style={{ color: active ? "#ffffff" : colors.inkSoft }}
                >
                  {item.label}
                </Text>
                {item.count > 0 && (
                  <View
                    className="h-5 min-w-[20px] items-center justify-center rounded-full px-1.5"
                    style={{ backgroundColor: active ? "rgba(255,255,255,0.28)" : palette.accent }}
                  >
                    <Text
                      className="text-xs font-bold"
                      style={{ color: active ? "#ffffff" : palette.fg }}
                    >
                      {item.count}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {activeTab === "memorize" ? (
          <View className="mt-5 gap-5">
            {kind !== "vocab" && (
              <EmptyBox icon="construct-outline" text="암기 화면을 준비 중이에요" />
            )}
            {kind === "vocab" && memorize.length === 0 && (
              <EmptyBox icon="book-outline" text="암기할 단어장이 없어요" />
            )}
            {visibleGroups.map(([week, sets]) => (
              <View key={week ?? "none"} className="gap-2.5">
                <SectionLabel text={week !== null ? `${week}주차` : "주차 미지정"} />
                {sets.map((set) => (
                  <ItemRow
                    key={set.id}
                    kind={kind}
                    title={set.title}
                    onPress={() => router.push(`/memorize/${set.id}`)}
                  />
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
        ) : (
          <View className="mt-5 gap-5">
            {tests.length === 0 && (
              <EmptyBox
                icon="checkmark-circle-outline"
                text="응시할 시험이 없어요"
                hint="끝낸 시험은 학습 결과에서 볼 수 있어요"
              />
            )}
            {current.length > 0 && (
              <View className="gap-2.5">
                <SectionLabel text="이번 주 시험" />
                {current.map(({ task }) => (
                  <TestRow key={`${task.kind}:${task.id}`} task={task} kind={kind} />
                ))}
              </View>
            )}
            {past.length > 0 && (
              <View className="gap-2.5">
                <SectionLabel text="지난 주에 못 끝낸 시험" tone="warn" />
                {past.map(({ task }) => (
                  <TestRow key={`${task.kind}:${task.id}`} task={task} kind={kind} />
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function SectionLabel({ text, tone }: { text: string; tone?: "warn" }) {
  return (
    <Text
      className="px-1 text-base font-bold"
      style={{ color: tone === "warn" ? "#c2410c" : colors.inkSoft }}
    >
      {text}
    </Text>
  );
}

function EmptyBox({
  icon,
  text,
  hint,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  text: string;
  hint?: string;
}) {
  return (
    <View className="items-center rounded-3xl border border-line bg-white px-6 py-10">
      <Ionicons name={icon} size={34} color={colors.inkMuted} />
      <Text className="mt-3 text-lg text-ink-soft">{text}</Text>
      {hint && <Text className="mt-1 text-sm text-ink-soft">{hint}</Text>}
    </View>
  );
}

// 암기/시험 공통 한 줄: 유형 색 아이콘 + 제목 + (뱃지) + 화살표.
function ItemRow({
  kind,
  title,
  subtitle,
  badge,
  onPress,
}: {
  kind: keyof typeof categoryColors;
  title: string;
  subtitle?: string;
  badge?: { label: string; fg: string; bg: string };
  onPress: () => void;
}) {
  const palette = categoryColors[kind];
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center rounded-2xl border border-line bg-white px-4 py-4 active:opacity-80"
    >
      <View
        className="h-11 w-11 items-center justify-center rounded-xl"
        style={{ backgroundColor: palette.bg }}
      >
        <Ionicons name={KIND_ICON[kind]} size={22} color={palette.fg} />
      </View>
      <View className="ml-3 flex-1 pr-2">
        <Text className="text-lg font-bold text-ink" numberOfLines={2}>
          {title}
        </Text>
        {subtitle && <Text className="mt-0.5 text-sm text-ink-soft">{subtitle}</Text>}
      </View>
      {badge && (
        <View className="mr-2 rounded-full px-2.5 py-1" style={{ backgroundColor: badge.bg }}>
          <Text className="text-xs font-bold" style={{ color: badge.fg }}>
            {badge.label}
          </Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={20} color={colors.inkMuted} />
    </Pressable>
  );
}

function TestRow({ task, kind }: { task: WeeklyTask; kind: keyof typeof categoryColors }) {
  const badge = task.is_overdue
    ? { label: "기한 초과", fg: "#b91c1c", bg: "#fee2e2" }
    : task.is_late
      ? { label: "지각 응시", fg: "#c2410c", bg: "#ffedd5" }
      : task.status === "in_progress"
        ? { label: "진행 중", fg: categoryColors[kind].fg, bg: categoryColors[kind].accent }
        : undefined;
  return (
    <ItemRow
      kind={kind}
      title={task.title}
      subtitle={task.week !== null ? `${task.week}주차` : undefined}
      badge={badge}
      onPress={() => router.push(testRoute(task.kind, task.id))}
    />
  );
}
