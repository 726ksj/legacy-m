import { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, View } from "react-native";
import { Text } from "../../components/AppText";
import { router, useFocusEffect } from "expo-router";
import { supabase } from "../../lib/supabase";
import { fetchStudyItems, KINDS, type StudyItem } from "../../lib/study";
import { type TestKind } from "../../lib/weekly";
import { colors } from "../../lib/theme";
import ScreenHeader from "../../components/ScreenHeader";
import KindCard from "../../components/KindCard";

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

        {/* 학습 결과의 주차 칩 줄과 같은 높이(h-10)로 맞춰 아래 카드 위치가 같다. */}
        <View className="mt-6 h-10 justify-center">
          <Text className="text-base text-ink-soft">학습할 유형을 선택하세요.</Text>
        </View>

        <View className="mt-4 gap-4">
          {[KINDS.slice(0, 2), KINDS.slice(2, 4)].map((row) => (
            <View key={row[0]} className="flex-row gap-4">
              {row.map((kind) => (
                <KindCard
                  key={kind}
                  kind={kind}
                  subtitle={
                    pendingOf(kind) > 0 ? `시험 ${pendingOf(kind)}개` : "응시할 시험 없음"
                  }
                  onPress={() => router.push(`/learn/${kind}`)}
                />
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
