import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { Text } from "../../components/AppText";
import { router, useFocusEffect } from "expo-router";
import { supabase } from "../../lib/supabase";
import { colors } from "../../lib/theme";
import { fetchCourseResults, type CourseResults } from "../../lib/results";
import { KINDS } from "../../lib/study";
import ScreenHeader from "../../components/ScreenHeader";
import EmptyState from "../../components/EmptyState";
import KindCard from "../../components/KindCard";
import { latestChange, trendOf } from "../../lib/trend";

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-full border px-3.5 py-1.5 ${
        selected ? "border-brand bg-brand" : "border-line bg-white"
      }`}
    >
      <Text
        className={`text-sm font-bold ${selected ? "text-white" : "text-ink-soft"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// 학습 결과 허브: 유형 카드에서 최근 점수를 보고, 카드를 누르면 그 유형의 주차별 성적 흐름과 결과를 본다.
export default function ResultsScreen() {
  const [courses, setCourses] = useState<CourseResults[]>([]);
  const [courseKey, setCourseKey] = useState<string | null>(null);
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
    setCourses(await fetchCourseResults().catch(() => []));
  }, []);

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

  // 강좌 선택(첫 강좌가 기본).
  const course = useMemo(
    () => courses.find((c) => c.key === courseKey) ?? courses[0] ?? null,
    [courses, courseKey],
  );

  if (loading) {
    return (
      <View className="flex-1 bg-blush">
        <ScreenHeader title="학습 결과" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brand} />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-blush">
      <ScreenHeader title="학습 결과" />
      <ScrollView
        contentContainerClassName="px-6 pb-6"
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand}
          />
        }
      >
        {!course ? (
          <EmptyState
            icon="stats-chart-outline"
            title="아직 학습 기록이 없어요"
            description={"수강 중인 강좌의\n주차별 결과가 여기에 쌓여요"}
          />
        ) : (
          <>
            {courses.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mt-5"
              >
                <View className="flex-row gap-2">
                  {courses.map((c) => (
                    <Chip
                      key={c.key}
                      label={c.label}
                      selected={c.key === course.key}
                      onPress={() => setCourseKey(c.key)}
                    />
                  ))}
                </View>
              </ScrollView>
            )}

            {/* 학습 화면의 안내 문구 줄과 같은 높이(h-10)라서 아래 카드 위치가 같다. */}
            <View className={`${courses.length > 1 ? "mt-4" : "mt-6"} h-10 justify-center`}>
              <Text className="text-base text-ink-soft">
                유형을 고르면 성적 흐름이 보여요.
              </Text>
            </View>

            {/* 네 유형을 세로로 놓고, 남는 화면 높이를 똑같이 나눈다. */}
            <View className="mt-4 flex-1 gap-4">
              {KINDS.map((kind) => {
                // 카드에는 이 유형의 가장 최근 점수와 바로 앞 점수 대비 변화를 보여 준다.
                const change = latestChange(trendOf(course, kind));
                const delta = change?.delta ?? null;
                const deltaText =
                  delta === null ? "" : delta > 0 ? `  ▲${delta}` : delta < 0 ? `  ▼${-delta}` : "  –";
                return (
                  <KindCard
                    key={kind}
                    kind={kind}
                    subtitle={change ? `최근 ${change.score}점${deltaText}` : "응시한 시험 없음"}
                    onPress={() =>
                      router.push(
                        `/week-results/${kind}?course=${encodeURIComponent(course.key)}` as never,
                      )
                    }
                  />
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
