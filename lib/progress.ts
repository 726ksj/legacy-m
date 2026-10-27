import { supabase } from "./supabase";
import { getTestStatus } from "./test";

export type SetStatus = "not_started" | "in_progress" | "completed";

// 단어장별 응시 상태: 모든 회차를 끝냈으면 완료(학습 목록에서는 빠지고 학습 결과로
// 넘어간다), 2차 시험까지 마쳤어도 재시험이 남았거나 시험을 시작만 했으면 진행 중.
// (본인 응시 기록만 RLS로 조회된다)
export async function fetchVocabStatuses(): Promise<Map<string, SetStatus>> {
  const { data } = await supabase
    .from("vocab_test_attempts")
    .select("vocab_set_id, round_no, status");

  const statuses = new Map<string, SetStatus>();
  const secondExamDone: string[] = [];
  for (const row of data ?? []) {
    if (!statuses.has(row.vocab_set_id)) {
      statuses.set(row.vocab_set_id, "in_progress");
    }
    if (row.round_no === 3 && row.status === "completed") {
      secondExamDone.push(row.vocab_set_id);
    }
  }

  // 남은 회차(재시험)는 서버가 판단한다. 2차 시험을 마친 세트만 물어본다.
  await Promise.all(
    secondExamDone.map(async (setId) => {
      try {
        const status = await getTestStatus(setId);
        const finished =
          status.next_round === null &&
          !status.rounds.some((round) => round.status === "in_progress");
        if (finished) statuses.set(setId, "completed");
      } catch {
        // 확인하지 못하면 진행 중으로 두어 목록에 계속 보이게 한다.
      }
    }),
  );
  return statuses;
}
