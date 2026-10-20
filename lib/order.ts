import { supabase } from "./supabase";

// 순서 배열: 주어진 글(첫 문장) 뒤에 이어질 세 덩어리(A)(B)(C)를 순서대로 고르는 문제.
// 덩어리 배치와 보기는 서버가 섞어서 만들고, 채점도 서버가 한다.

export interface OrderQuestionProgress {
  question_id: string;
  order_no: number;
  attempt_id: string | null;
  answered: boolean;
  is_correct: boolean | null;
}

export interface OrderProgress {
  title: string;
  week: number | null;
  questions: OrderQuestionProgress[];
  total: number;
  answered: number;
  correct: number;
  completed: boolean;
  score: number | null;
  is_late: boolean;
  is_overdue: boolean;
}

export interface OrderPart {
  label: "A" | "B" | "C";
  text: string;
}

export interface OrderAttempt {
  attempt_id: string;
  question_id: string;
  order_no: number;
  intro: string;
  parts: OrderPart[];
  // 예: "(B) - (C) - (A)". 서버가 섞은 순서 그대로 보여 준다.
  options: string[];
  answered: boolean;
  selected_index: number | null;
  is_correct: boolean | null;
  // 답한 문제에만 내려온다(서버가 미리 알려주지 않는다).
  correct_index: number | null;
}

export interface OrderAnswerResult extends OrderAttempt {
  correct_option: string;
  set_completed: boolean;
}

// 내가 볼 수 있는 모든 순서 배열 세트와 결과(학습 결과·홈 요약용).
export interface OrderOverviewRow {
  id: string;
  title: string;
  week: number | null;
  course_id: string;
  total: number;
  answered: number;
  completed: boolean;
  score: number | null;
  correct: number | null;
  completed_at: string | null;
  is_late: boolean;
  is_overdue: boolean;
}

export async function fetchOrderOverview(): Promise<OrderOverviewRow[]> {
  const { data, error } = await supabase.rpc("get_order_overview");
  if (error) throw new Error(error.message);
  return (data ?? []) as OrderOverviewRow[];
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const getOrderProgress = (setId: string) =>
  rpc<OrderProgress>("get_order_set_progress", { p_set_id: setId });

export const startOrderAttempt = (questionId: string) =>
  rpc<OrderAttempt>("start_order_attempt", { p_question_id: questionId });

export const answerOrderQuestion = (attemptId: string, selectedIndex: number) =>
  rpc<OrderAnswerResult>("answer_order_question", {
    p_attempt_id: attemptId,
    p_selected_index: selectedIndex,
  });

// DB 함수가 던지는 영문 메시지를 학생에게 보여줄 문구로 바꾼다.
export function friendlyOrderError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("not available")) {
    return "이 순서 배열은 지금 볼 수 없어요.";
  }
  return "순서 배열을 불러오지 못했어요. 잠시 후 다시 시도해주세요.";
}
