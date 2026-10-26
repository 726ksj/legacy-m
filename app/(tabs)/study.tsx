import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { Text } from "../../components/AppText";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { fetchStudyItems, KINDS, KIND_TITLES, type StudyItem } from "../../lib/study";
import { type TestKind } from "../../lib/weekly";
import { categoryColors, colors } from "../../lib/theme";
import ScreenHeader from "../../components/ScreenHeader";

const KIND_ICONS: Record<TestKind, React.ComponentProps<typeof Ionicons>["name"]> = {
  vocab: "text",
  writing: "create-outline",
  order: "swap-vertical",
  sentence: "reorder-three",
};

// 학습 유형 한 칸. 세로로 긴 카드에 아이콘, 이름, 남은 시험 수를 보여 준다.
function KindCard({ kind, pending }: { kind: TestKind; pending: number }) {
  const palette = categoryColors[kind];
  return (
    <Pressable
      onPress={() => router.push(`/learn/${kind}`)}
      style={{
        backgroundColor: palette.bg,
        borderWidth: 1,
        borderColor: palette.border,
        aspectRatio: 0.78,
      }}
      className="flex-1 justify-between rounded-3xl p-5 active:opacity-80"
    >
      <View
        style={{ backgroundColor: palette.accent }}
        className="h-12 w-12 items-center justify-center rounded-2xl"
      >
        <Ionicons name={KIND_ICONS[kind]} size={26} color={palette.fg} />
      </View>
      <View>
        <Text className="text-xl font-extrabold" style={{ color: palette.fg }}>
          {KIND_TITLES[kind]}
        </Text>
        <Text className="mt-1 text-base text-ink-soft">
          {pending > 0 ? `시험 ${pending}개` : "응시할 시험 없음"}
        </Text>
      </View>
    </Pressable>
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
      setItems(await fetchStudyItems());
    } catch {
      setError("학습 목록을 불러오지 못했어요.");
    }
  }, []);

  // 시험을 마치고 돌아올 때마다 개수를 다시 불러온다.
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

  const pendingOf = (kind: TestKind) =>
    items.filter(({ task }) => task.kind === kind).length;

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

        <Text className="mt-6 text-base text-ink-soft">
          학습할 유형을 선택하세요.
        </Text>

        <View className="mt-4 gap-4">
          {[KINDS.slice(0, 2), KINDS.slice(2, 4)].map((row) => (
            <View key={row[0]} className="flex-row gap-4">
              {row.map((kind) => (
                <KindCard key={kind} kind={kind} pending={pendingOf(kind)} />
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
