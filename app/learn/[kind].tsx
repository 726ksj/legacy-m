import { useCallback, useState } from "react";
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
import { categoryColors, colors } from "../../lib/theme";
import ScreenHeader from "../../components/ScreenHeader";
import TaskRow from "../../components/TaskRow";

// 학습 유형 화면: 암기할 것과 시험 볼 것을 나눠 보여 준다.
// 암기 화면은 지금 단어(VOCA)에만 있고, 나머지 유형은 준비 중이다.
export default function LearnKindScreen() {
  const { kind: kindParam } = useLocalSearchParams<{ kind: string }>();
  const kind = isTestKind(kindParam) ? kindParam : null;

  const [tests, setTests] = useState<StudyItem[]>([]);
  const [memorize, setMemorize] = useState<MemorizeSet[]>([]);
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

  // 이번 주 시험을 앞에, 지난 주에 못 끝낸 시험을 뒤에 나열한다.
  const ordered = [
    ...tests.filter(({ task }) => !task.is_late && !task.is_overdue),
    ...tests.filter(({ task }) => task.is_late || task.is_overdue),
  ];

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
            <Text className="text-base font-semibold text-red-500">
              {error}
            </Text>
          </View>
        )}

        <View className="mt-8 gap-3">
          <Text className="text-2xl font-extrabold" style={{ color: palette.fg }}>
            암기
          </Text>
          {kind !== "vocab" && (
            <View className="rounded-3xl border border-line bg-white px-6 py-6">
              <Text className="text-lg text-ink-soft">암기 화면을 준비 중이에요</Text>
            </View>
          )}
          {kind === "vocab" && memorize.length === 0 && (
            <View className="rounded-3xl border border-line bg-white px-6 py-6">
              <Text className="text-lg text-ink-soft">암기할 단어장이 없어요</Text>
            </View>
          )}
          {memorize.map((set) => (
            <Pressable
              key={set.id}
              onPress={() => router.push(`/memorize/${set.id}`)}
              style={{
                backgroundColor: "#ffffff",
                borderWidth: 1,
                borderColor: palette.border,
              }}
              className="flex-row items-center justify-between rounded-3xl px-6 py-6 active:opacity-80"
            >
              <View className="flex-1 pr-3">
                <Text className="text-xl font-bold text-ink">{set.title}</Text>
                {set.week !== null && (
                  <Text className="mt-1 text-base text-ink-soft">{set.week}주차</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={22} color={colors.inkMuted} />
            </Pressable>
          ))}
        </View>

        <View className="mt-8 gap-3">
          <Text className="text-2xl font-extrabold" style={{ color: palette.fg }}>
            시험
          </Text>
          {ordered.length === 0 && (
            <View className="rounded-3xl border border-line bg-white px-6 py-6">
              <Text className="text-lg text-ink-soft">응시할 시험이 없어요</Text>
            </View>
          )}
          {ordered.map(({ task }) => (
            <TaskRow key={`${task.kind}:${task.id}`} task={task} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
