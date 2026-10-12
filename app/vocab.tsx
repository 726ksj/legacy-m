import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { supabase } from "../lib/supabase";
import { fetchVocabOverview, type VocabGroup } from "../lib/vocab";
import { categoryColors, colors } from "../lib/theme";
import ScreenHeader from "../components/ScreenHeader";
import EmptyState from "../components/EmptyState";
import StatusChip from "../components/StatusChip";
import { fetchVocabStatuses, type SetStatus } from "../lib/progress";

export default function VocabScreen() {
  const [groups, setGroups] = useState<VocabGroup[]>([]);
  const [statuses, setStatuses] = useState<Map<string, SetStatus>>(new Map());
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
      const [overview, nextStatuses] = await Promise.all([
        fetchVocabOverview(),
        fetchVocabStatuses(),
      ]);
      setGroups(overview.groups);
      setStatuses(nextStatuses);
    } catch {
      setError("단어장을 불러오지 못했습니다.");
    }
  }, []);

  // 시험을 마치고 돌아올 때마다 진행 상태를 다시 불러온다.
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

  return (
    <View className="flex-1 bg-blush">
      <ScreenHeader title="단어 학습" back />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-6 py-6 gap-8"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.brand}
            />
          }
        >
          {error && (
            <View className="rounded-xl bg-red-50 px-4 py-3">
              <Text className="text-base font-semibold text-red-500">
                {error}
              </Text>
            </View>
          )}

          {!error && groups.length === 0 && (
            <EmptyState
              icon="book-outline"
              title="아직 배정된 단어장이 없어요"
              description="강사님이 단어장을 배정하면 여기에 나타나요"
            />
          )}

          {groups.map((group) => (
            <View key={group.key} className="gap-3">
              <Text className="text-base font-bold text-ink-soft">
                {group.label}
              </Text>

              <View className="gap-3">
                {group.sets.map((set) => {
                  const status = statuses.get(set.id) ?? "not_started";
                  return (
                    <Pressable
                      key={set.id}
                      onPress={() => router.push(`/test/${set.id}`)}
                      style={{
                        backgroundColor: categoryColors.vocab.bg,
                        borderWidth: 1,
                        borderColor: categoryColors.vocab.border,
                      }}
                      className="rounded-3xl px-5 py-5 active:opacity-80"
                    >
                      <View className="flex-row items-center justify-between gap-3">
                        <View className="flex-1 flex-row items-center gap-2">
                          {set.week !== null && (
                            <View
                              className="rounded-full px-2.5 py-0.5"
                              style={{
                                backgroundColor: categoryColors.vocab.accent,
                              }}
                            >
                              <Text
                                className="text-sm font-bold"
                                style={{ color: categoryColors.vocab.fg }}
                              >
                                {set.week}주차
                              </Text>
                            </View>
                          )}
                          <Text className="flex-1 text-lg font-bold text-ink">
                            {set.title}
                          </Text>
                        </View>
                        <StatusChip status={status} />
                      </View>
                      <Text className="mt-2 text-sm text-ink-soft">
                        단어 {set.wordCount}개
                        {set.lastScore !== null
                          ? ` · 최근 점수 ${set.lastScore}점`
                          : ""}
                      </Text>
                      <Text
                        className="mt-2 text-sm font-bold"
                        style={{ color: categoryColors.vocab.fg }}
                      >
                        {status === "completed"
                          ? "다시 보기 ›"
                          : status === "in_progress"
                            ? "이어서 하기 ›"
                            : "시작하기 ›"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
