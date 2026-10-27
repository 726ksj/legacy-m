import { supabase } from "./supabase";

// 문장 배열: 주어진 첫 문장 뒤에 이어질 문장들(A)(B)(C)…을 순서대로 눌러 배열하는 문제.
// 문장 배치는 서버가 섞어서 만들고, 채점도 서버가 한다.

export interface SentenceQuestionProgress {
  question_id: string;
  order_no: number;
  attempt_id: string | null;
  answered: boolean;
  is_correct: boolean | null;
}

export interface SentenceProgress {
  title: string;
  week: number | null;
  // 이 진행 상황이 가리키는 회차(1~5).
  round_no: number;
  questions: SentenceQuestionProgress[];
  total: number;
  answered: number;
  correct: number;
  completed: boolean;
  score: number | null;
  is_late: boolean;
  is_overdue: boolean;
}

export interface SentenceItem {
  // 화면에 붙는 이름 "A", "B", "C"…
  label: string;
  text: string;
  // 답한 문제에만 내려온다(정답 순서로 몇 번째 문장인지).
  correct_no: number | null;
}

export interface SentenceAttempt {
  attempt_id: string;
  question_id: string;
  order_no: number;
  intro: string;
  sentences: SentenceItem[];
  answered: boolean;
  // 학생이 고른 순서(고른 순서대로 적은 화면 자리 번호, 1부터).
  selected_order: number[] | null;
  is_correct: boolean | null;
  // 정답 순서와 같은 자리에 놓은 문장 수(안내용).
  correct_positions: number | null;
  // 답한 문제에만 내려온다. 예: ["C", "A", "B"]
  correct_order: string[] | null;
}

export interface SentenceAnswerResult extends SentenceAttempt {
  // 이 답으로 회차의 마지막 문제를 끝냈는지.
  round_completed: boolean;
  set_completed: boolean;
}

// 내가 볼 수 있는 모든 문장 배열 세트와 결과(학습 결과·홈 요약용).
export interface SentenceOverviewRow {
  id: string;
  title: string;
  week: number | null;
  course_id: string;
  total: number;
  answered: number;
  completed: boolean;
  score: number | null;
  correct: number | null;
  // 1차·2차 시험 점수(완료 점수는 1차 40% + 2차 60%).
  first_score: number | null;
  final_score: number | null;
  completed_at: string | null;
  is_late: boolean;
  is_overdue: boolean;
}

export async function fetchSentenceOverview(): Promise<SentenceOverviewRow[]> {
  const { data, error } = await supabase.rpc("get_sentence_overview");
  if (error) throw new Error(error.message);
  return (data ?? []) as SentenceOverviewRow[];
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

// round를 생략하면 지금 풀 회차(풀던 회차 또는 다음 회차)의 진행 상황.
export const getSentenceProgress = (setId: string, round?: number) =>
  rpc<SentenceProgress>("get_sentence_set_progress", {
    p_set_id: setId,
    p_round: round ?? null,
  });

export const startSentenceAttempt = (questionId: string, round: number) =>
  rpc<SentenceAttempt>("start_sentence_attempt", {
    p_question_id: questionId,
    p_round: round,
  });

export const answerSentenceQuestion = (attemptId: string, order: number[]) =>
  rpc<SentenceAnswerResult>("answer_sentence_question", {
    p_attempt_id: attemptId,
    p_order: order,
  });

// DB 함수가 던지는 영문 메시지를 학생에게 보여줄 문구로 바꾼다.
export function friendlySentenceError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("not available")) {
    return "이 문장 배열은 지금 볼 수 없어요.";
  }
  return "문장 배열을 불러오지 못했어요. 잠시 후 다시 시도해주세요.";
}
