import { supabase } from "./supabase";
import { fetchOrderOverview, type OrderOverviewRow } from "./order";
import { fetchSentenceOverview, type SentenceOverviewRow } from "./sentence";
import { fetchWritingOverview, type WritingOverviewRow } from "./writing";
import type { TestKind } from "./weekly";

export interface RecentScore {
  key: string;
  kind: TestKind;
  title: string;
  // 0~100. 어순 배열은 얻은 점수 / 만점으로 환산한다.
  percent: number;
  label: string;
}

export interface HomeStats {
  // 오늘(한국 시간)을 포함해 연속으로 학습한 날 수. 오늘 아직 안 했으면 어제까지 센다.
  streak: number;
  studiedToday: boolean;
  // 오늘 푼 문제 수(단어 시험 문항 + 어순 배열 제출).
  solvedToday: number;
  // 가장 최근 시험 결과 3개와 그 평균, 그 직전 3개의 평균(비교용).
  recent: RecentScore[];
  average: number | null;
  previousAverage: number | null;
}

const KST_MS = 9 * 60 * 60 * 1000;

// ISO 시각의 한국 날짜 "YYYY-MM-DD".
const kstDay = (iso: string) =>
  new Date(new Date(iso).getTime() + KST_MS).toISOString().slice(0, 10);

const dayBefore = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
};

interface VocabAttemptRow {
  started_at: string;
  completed_at: string | null;
  total_count: number;
  status: string;
}

interface WritingAttemptRow {
  started_at: string;
  submitted_at: string | null;
}

interface VocabResultRow {
  vocab_set_id: string;
  score: number;
  tested_at: string;
  vocab_sets: { title: string } | null;
}

const average = (items: RecentScore[]) =>
  items.length === 0
    ? null
    : Math.round(items.reduce((sum, item) => sum + item.percent, 0) / items.length);

export async function fetchHomeStats(): Promise<HomeStats> {
  const [
    { data: vocabAttempts },
    { data: writingAttempts },
    { data: vocabResults },
    writingOverview,
    orderOverview,
    sentenceOverview,
  ] = await Promise.all([
    supabase
      .from("vocab_test_attempts")
      .select("started_at, completed_at, total_count, status")
      .order("started_at", { ascending: false })
      .limit(300)
      .returns<VocabAttemptRow[]>(),
    supabase
      .from("writing_attempts")
      .select("started_at, submitted_at")
      .order("started_at", { ascending: false })
      .limit(500)
      .returns<WritingAttemptRow[]>(),
    supabase
      .from("vocab_test_results")
      .select("vocab_set_id, score, tested_at, vocab_sets(title)")
      .order("tested_at", { ascending: false })
      .limit(6)
      .returns<VocabResultRow[]>(),
    fetchWritingOverview().catch(() => [] as WritingOverviewRow[]),
    fetchOrderOverview().catch(() => [] as OrderOverviewRow[]),
    fetchSentenceOverview().catch(() => [] as SentenceOverviewRow[]),
  ]);

  // 학습한 날: 시험이나 문장 풀이를 시작한 날.
  const days = new Set<string>();
  for (const row of vocabAttempts ?? []) days.add(kstDay(row.started_at));
  for (const row of writingAttempts ?? []) days.add(kstDay(row.started_at));

  // 순서 배열은 시도 기록을 직접 읽을 수 없어서, 완료한 날을 학습한 날로 센다.
  const orderDone = orderOverview.filter(
    (o) => o.completed && o.completed_at,
  );
  for (const o of orderDone) days.add(kstDay(o.completed_at!));
  const writingDone = writingOverview.filter(
    (o) => o.completed && o.completed_at,
  );
  for (const o of writingDone) days.add(kstDay(o.completed_at!));
  const sentenceDone = sentenceOverview.filter(
    (o) => o.completed && o.completed_at,
  );
  for (const o of sentenceDone) days.add(kstDay(o.completed_at!));

  const today = kstDay(new Date().toISOString());
  const studiedToday = days.has(today);
  let streak = 0;
  for (let day = studiedToday ? today : dayBefore(today); days.has(day); ) {
    streak += 1;
    day = dayBefore(day);
  }

  let solvedToday = 0;
  for (const row of vocabAttempts ?? []) {
    if (row.status === "completed" && row.completed_at && kstDay(row.completed_at) === today) {
      solvedToday += row.total_count;
    }
  }
  for (const row of writingAttempts ?? []) {
    if (row.submitted_at && kstDay(row.submitted_at) === today) solvedToday += 1;
  }

  const scored = [
    ...(vocabResults ?? []).map((r) => ({
      date: r.tested_at,
      item: {
        key: `vocab:${r.vocab_set_id}`,
        kind: "vocab" as const,
        title: r.vocab_sets?.title ?? "단어 테스트",
        percent: Math.round(r.score),
        label: `${Math.round(r.score)}점`,
      },
    })),
    ...orderDone.map((o) => ({
      date: o.completed_at!,
      item: {
        key: `order:${o.id}`,
        kind: "order" as const,
        title: o.title,
        percent: Math.round(o.score ?? 0),
        label: `${Math.round(o.score ?? 0)}점`,
      },
    })),
    ...sentenceDone.map((o) => ({
      date: o.completed_at!,
      item: {
        key: `sentence:${o.id}`,
        kind: "sentence" as const,
        title: o.title,
        percent: Math.round(o.score ?? 0),
        label: `${Math.round(o.score ?? 0)}점`,
      },
    })),
    ...writingDone.map((o) => ({
      date: o.completed_at!,
      item: {
        key: `writing:${o.id}`,
        kind: "writing" as const,
        title: o.title,
        percent: Math.round(o.score ?? 0),
        label: `${Math.round(o.score ?? 0)}점`,
      },
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((entry) => entry.item);

  const recent = scored.slice(0, 3);
  return {
    streak,
    studiedToday,
    solvedToday,
    recent,
    average: average(recent),
    previousAverage: average(scored.slice(3, 6)),
  };
}
