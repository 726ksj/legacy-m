import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { supabase } from "../../lib/supabase";
import { categoryColors, colors } from "../../lib/theme";
import ScreenHeader from "../../components/ScreenHeader";
import EmptyState from "../../components/EmptyState";

interface VocabResultRow {
  id: string;
  score: number;
  total_count: number;
  correct_count: number;
  tested_at: string;
  vocab_sets: { title: string } | null;
}

interface WritingResultRow {
  writing_set_id: string;
  points: number;
  max_points: number;
  completed_at: string;
  writing_sets: { title: string } | null;
}

// 단어 테스트와 어순 배열 결과를 한 목록으로 합쳐 최신순으로 보여준다.
interface ResultItem {
  key: string;
  kind: "vocab" | "writing";
  title: string;
  scoreLabel: string;
  detail: string;
  date: string;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

const KIND_LABEL = { vocab: "단어", writing: "어순 배열" } as const;

export default function ResultsScreen() {
  const [items, setItems] = useState<ResultItem[]>([]);
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

    const [{ data: vocab }, { data: writing }, { data: lateAttempts }] =
      await Promise.all([
        supabase
          .from("vocab_test_results")
          .select(
            "id, score, total_count, correct_count, tested_at, vocab_sets(title)",
          )
          .returns<VocabResultRow[]>(),
        supabase
          .from("writing_set_completions")
          .select(
            "writing_set_id, points, max_points, completed_at, writing_sets(title)",
          )
          .returns<WritingResultRow[]>(),
        // 지각 응시한 어순 배열 세트는 점수 반영 방식이 정해질 때까지 결과에서 뺀다.
        supabase
          .from("writing_attempts")
          .select("writing_set_id")
          .eq("is_late", true),
      ]);

    const lateSets = new Set(
      (lateAttempts ?? []).map((row) => row.writing_set_id),
    );

    const merged: ResultItem[] = [
      ...(vocab ?? []).map<ResultItem>((r) => ({
        key: `vocab:${r.id}`,
        kind: "vocab",
        title: r.vocab_sets?.title ?? "단어 테스트",
        scoreLabel: `${r.score}점`,
        detail: `${r.correct_count}/${r.total_count}개 정답`,
        date: r.tested_at,
      })),
      ...(writing ?? [])
        .filter((r) => !lateSets.has(r.writing_set_id))
        .map<ResultItem>((r) => ({
          key: `writing:${r.writing_set_id}`,
          kind: "writing",
          title: r.writing_sets?.title ?? "어순 배열",
          scoreLabel: `${r.points} / ${r.max_points}점`,
          detail: "모든 문장 완성",
          date: r.completed_at,
        })),
    ].sort((a, b) => b.date.localeCompare(a.date));

    setItems(merged);
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
          단어 테스트와 어순 배열 기록이에요
        </Text>

        <View className="mt-4 gap-3">
          {items.length === 0 && (
            <EmptyState
              icon="stats-chart-outline"
              title="아직 학습 기록이 없어요"
              description="시험을 마치면 점수가 여기에 쌓여요"
            />
          )}

          {items.map((item) => {
            const palette = categoryColors[item.kind];
            return (
              <View
                key={item.key}
                className="rounded-3xl px-5 py-4"
                style={{
                  backgroundColor: palette.bg,
                  borderWidth: 1,
                  borderColor: palette.border,
                }}
              >
                <View className="flex-row items-center justify-between gap-3">
                  <View className="flex-1 flex-row items-center gap-2">
                    <View
                      className="rounded-full px-2.5 py-0.5"
                      style={{ backgroundColor: palette.accent }}
                    >
                      <Text
                        className="text-sm font-bold"
                        style={{ color: palette.fg }}
                      >
                        {KIND_LABEL[item.kind]}
                      </Text>
                    </View>
                    <Text className="flex-1 text-lg font-bold text-ink">
                      {item.title}
                    </Text>
                  </View>
                  <View className="rounded-full bg-white px-3 py-1">
                    <Text
                      className="text-base font-extrabold"
                      style={{ color: palette.fg }}
                    >
                      {item.scoreLabel}
                    </Text>
                  </View>
                </View>
                <Text className="mt-1.5 text-sm text-ink-soft">
                  {item.detail} · {formatDate(item.date)}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
