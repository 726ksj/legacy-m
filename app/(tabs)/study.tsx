import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { supabase } from "../../lib/supabase";
import { fetchVocabOverview } from "../../lib/vocab";
import { fetchWritingOverview } from "../../lib/progress";
import { StudyCardList } from "../../components/StudyCards";
import { colors } from "../../lib/theme";
import ScreenHeader from "../../components/ScreenHeader";

export default function StudyScreen() {
  const [totalSets, setTotalSets] = useState(0);
  const [testedSetCount, setTestedSetCount] = useState(0);
  const [writingTotal, setWritingTotal] = useState(0);
  const [writingDone, setWritingDone] = useState(0);
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

    const [overview, writing] = await Promise.all([
      fetchVocabOverview(),
      fetchWritingOverview(),
    ]);
    setTotalSets(overview.totalSets);
    setTestedSetCount(overview.testedSetCount);
    setWritingTotal(writing.total);
    setWritingDone(writing.done);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

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
        <Text className="mt-6 text-base text-ink-soft">
          원하는 학습 유형을 선택하세요
        </Text>

        <View className="mt-4">
          <StudyCardList
            totalSets={totalSets}
            testedSetCount={testedSetCount}
            writingTotal={writingTotal}
            writingDone={writingDone}
          />
        </View>
      </ScrollView>
    </View>
  );
}
