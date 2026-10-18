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
import { fetchVocabOverview } from "../../lib/vocab";
import { fetchWritingOverview } from "../../lib/progress";
import {
  fetchWeeklyCourses,
  summarizeWeekly,
  type WeeklySummary,
} from "../../lib/weekly";
import { StudyCardList } from "../../components/StudyCards";
import { colors } from "../../lib/theme";
import ScreenHeader from "../../components/ScreenHeader";

export default function HomeScreen() {
  const [name, setName] = useState<string | null>(null);
  const [weekly, setWeekly] = useState<WeeklySummary>({
    total: 0,
    done: 0,
    lateCount: 0,
    overdueCount: 0,
  });
  // 학습 유형 카드(단어 학습 n/m개 완료)에 쓰는 전체 단어장 현황.
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

    const [{ data: profile }, courses, overview, writing] = await Promise.all([
      supabase
        .from("profiles")
        .select("name")
        .eq("id", session.user.id)
        .single(),
      // 이번 주 요약을 못 불러와도 홈 화면 전체가 멈추지 않게 빈 목록으로 대체한다.
      fetchWeeklyCourses().catch(() => []),
      fetchVocabOverview(),
      fetchWritingOverview(),
    ]);

    setName(profile?.name ?? null);
    setWeekly(summarizeWeekly(courses));
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

  // 이번 주(현재 주차) 시험 중 끝낸 비율. 지난 주 미완료(지각·기한 초과)는 따로 센다.
  const progressPct =
    weekly.total === 0 ? 0 : Math.round((weekly.done / weekly.total) * 100);

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

        {/* 박스 전체를 누르면 이번 주에 응시해야 할 시험 목록(이번 주 할 일)으로 이동한다. */}
        <Pressable
          onPress={() => router.push("/week")}
          style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
          className="mt-6 rounded-3xl border border-line bg-white px-6 py-6 shadow-sm shadow-brand/20"
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

        <Text className="mb-3 mt-8 text-base font-bold text-ink-soft">
          학습 유형
        </Text>
        <StudyCardList
          totalSets={totalSets}
          testedSetCount={testedSetCount}
          writingTotal={writingTotal}
          writingDone={writingDone}
        />
      </ScrollView>
    </View>
  );
}
