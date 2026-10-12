import { supabase } from "./supabase";

export type SetStatus = "not_started" | "in_progress" | "completed";

export interface WritingSetProgress {
  status: SetStatus;
  points: number | null;
  maxPoints: number | null;
}

// 단어장별 응시 상태: 2차 시험까지 마쳤으면 완료, 시험을 시작만 했으면 진행 중.
// (본인 응시 기록만 RLS로 조회된다)
export async function fetchVocabStatuses(): Promise<Map<string, SetStatus>> {
  const { data } = await supabase
    .from("vocab_test_attempts")
    .select("vocab_set_id, round_no, status");

  const statuses = new Map<string, SetStatus>();
  for (const row of data ?? []) {
    const done = row.round_no === 3 && row.status === "completed";
    const prev = statuses.get(row.vocab_set_id);
    if (done) statuses.set(row.vocab_set_id, "completed");
    else if (prev !== "completed")
      statuses.set(row.vocab_set_id, "in_progress");
  }
  return statuses;
}

// 어순 배열(서술형) 세트별 상태: 모든 문장을 완성하면 완료와 점수.
export async function fetchWritingProgress(): Promise<
  Map<string, WritingSetProgress>
> {
  const [{ data: attempts }, { data: completions }] = await Promise.all([
    supabase.from("writing_attempts").select("writing_set_id"),
    supabase
      .from("writing_set_completions")
      .select("writing_set_id, points, max_points"),
  ]);

  const progress = new Map<string, WritingSetProgress>();
  for (const row of attempts ?? []) {
    progress.set(row.writing_set_id, {
      status: "in_progress",
      points: null,
      maxPoints: null,
    });
  }
  for (const row of completions ?? []) {
    progress.set(row.writing_set_id, {
      status: "completed",
      points: row.points,
      maxPoints: row.max_points,
    });
  }
  return progress;
}
