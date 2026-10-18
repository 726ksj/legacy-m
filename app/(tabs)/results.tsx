import { useCallback, useState } from "react";
import {
  Pressable,
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
  vocab_set_id: string;
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
  // 단어 결과를 누르면 회차별 점수와 틀린 문제를 볼 수 있는 시험 화면으로 간다.
  vocabSetId?: string;
  title: string;
  scoreLabel: string;
  detail: string;
  date: string;
  // 지각(주차 종료 후 5일 이내) 또는 기한 초과로 응시한 기록. 단어는 1차·2차
  // 시험을 각각, 서술형은 세트 단위로 하나.
  timings: TimingTag[];
}

interface TimingTag {
  label: string;
  kind: "late" | "overdue";
}

interface AttemptFlagRow {
  is_late: boolean;
  is_overdue: boolean;
}

const timingKind = (row: AttemptFlagRow): TimingTag["kind"] | null =>
  row.is_overdue ? "overdue" : row.is_late ? "late" : null;

const TIMING_LABEL = { late: "지각", overdue: "기한 초과" } as const;

// 단어 시험에서 기한이 걸린 회차(1차 시험, 2차 시험).
const EXAM_PREFIX: Record<number, string> = { 1: "1차 ", 3: "2차 " };

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

    const [
      { data: vocab },
      { data: writing },
      { data: vocabAttempts },
      { data: writingAttempts },
    ] = await Promise.all([
        supabase
          .from("vocab_test_results")
          .select(
            "id, vocab_set_id, score, total_count, correct_count, tested_at, vocab_sets(title)",
          )
          .returns<VocabResultRow[]>(),
        supabase
          .from("writing_set_completions")
          .select(
            "writing_set_id, points, max_points, completed_at, writing_sets(title)",
          )
          .returns<WritingResultRow[]>(),
        // 지각·기한 초과 표시는 1차·2차 시험 기록에서 가져온다(점수는 그대로 반영).
        supabase
          .from("vocab_test_attempts")
          .select("vocab_set_id, round_no, is_late, is_overdue")
          .in("round_no", [1, 3])
          .order("round_no", { ascending: true })
          .returns<
            (AttemptFlagRow & { vocab_set_id: string; round_no: number })[]
          >(),
        supabase
          .from("writing_attempts")
          .select("writing_set_id, is_late, is_overdue")
          .order("started_at", { ascending: true })
          .returns<(AttemptFlagRow & { writing_set_id: string })[]>(),
      ]);

    const vocabTiming = new Map<string, TimingTag[]>();
    for (const row of vocabAttempts ?? []) {
      const kind = timingKind(row);
      if (!kind) continue;
      const tags = vocabTiming.get(row.vocab_set_id) ?? [];
      tags.push({
        label: `${EXAM_PREFIX[row.round_no] ?? ""}${TIMING_LABEL[kind]}`,
        kind,
      });
      vocabTiming.set(row.vocab_set_id, tags);
    }
    const writingTiming = new Map<string, TimingTag[]>();
    for (const row of writingAttempts ?? []) {
      const kind = timingKind(row);
      if (!writingTiming.has(row.writing_set_id)) {
        writingTiming.set(
          row.writing_set_id,
          kind ? [{ label: TIMING_LABEL[kind], kind }] : [],
        );
      }
    }

    const merged: ResultItem[] = [
      ...(vocab ?? []).map<ResultItem>((r) => ({
        key: `vocab:${r.id}`,
        kind: "vocab",
        vocabSetId: r.vocab_set_id,
        title: r.vocab_sets?.title ?? "단어 테스트",
        scoreLabel: `${r.score}점`,
        detail: `${r.correct_count}/${r.total_count}개 정답`,
        date: r.tested_at,
        timings: vocabTiming.get(r.vocab_set_id) ?? [],
      })),
      ...(writing ?? []).map<ResultItem>((r) => ({
        key: `writing:${r.writing_set_id}`,
        kind: "writing",
        title: r.writing_sets?.title ?? "어순 배열",
        scoreLabel: `${r.points} / ${r.max_points}점`,
        detail: "모든 문장 완성",
        date: r.completed_at,
        timings: writingTiming.get(r.writing_set_id) ?? [],
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
              <Pressable
                key={item.key}
                disabled={!item.vocabSetId}
                onPress={() => router.push(`/test/${item.vocabSetId}`)}
                className="rounded-3xl px-5 py-4 active:opacity-80"
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
                <View className="mt-1.5 flex-row items-center gap-2">
                  <Text className="text-sm text-ink-soft">
                    {item.detail} · {formatDate(item.date)}
                  </Text>
                  {item.timings.map((tag) => (
                    <View
                      key={tag.label}
                      className={`rounded-full px-2 py-0.5 ${tag.kind === "overdue" ? "bg-red-100" : "bg-amber-100"}`}
                    >
                      <Text
                        className={`text-[12px] font-bold ${tag.kind === "overdue" ? "text-red-600" : "text-amber-700"}`}
                      >
                        {tag.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
