import { supabase } from "./supabase";
import type { TestKind } from "./weekly";

export interface TestRound {
  // 단어 시험만 회차마다 응시 기록(attempt)이 하나라서 id가 있다. 다른 유형은 null.
  attempt_id: string | null;
  round_no: number;
  status: "in_progress" | "completed";
  total_count: number;
  correct_count: number | null;
  score: number | null;
  // 이 회차를 시작한 시점 기준 지각(주차 종료 후 5일 이내) / 기한 초과.
  // 재시험은 부모 시험(1차 재시험=1차, 2차·3차 재시험=2차)의 값을 따른다.
  is_late: boolean;
  is_overdue: boolean;
}

// 복습: 시험(2~5회)을 모두 끝낸 뒤에만 available. 점수와 성적에 반영되지 않는다.
export interface ReviewInfo {
  available: boolean;
  // 어순/순서/문장 배열: 지금 시작하거나 이어서 풀 복습 회차 번호(6 이상).
  round_no?: number | null;
  // 단어: 풀던 복습의 attempt id.
  attempt_id?: string | null;
  in_progress: boolean;
  // 끝낸 복습 횟수와 가장 최근 복습 점수.
  count: number;
  last_score: number | null;
}

export interface TestStatus {
  rounds: TestRound[];
  review?: ReviewInfo;
  next_round: number | null;
  first_score: number | null;
  final_score: number | null;
  total_score: number | null;
  // 지금 응시를 시작하면 지각(주차 종료 후 5일 이내)인지. 아직 응시하지 않은
  // 시험의 안내용이다. 이미 응시한 회차는 rounds[].is_late를 쓴다.
  is_late: boolean;
  // 지금 응시를 시작하면 기한 초과(주차 종료 후 5일 초과)인지.
  is_overdue: boolean;
}

export interface AttemptQuestion {
  position: number;
  word: string;
  choices: string[];
  selected_index: number | null;
  is_correct: boolean | null;
  // 답한 문항에만 내려온다(서버가 미리 알려주지 않는다).
  correct_index: number | null;
  example: string | null;
  example_meaning: string | null;
}

export interface Attempt {
  id: string;
  vocab_set_id: string;
  round_no: number;
  status: "in_progress" | "completed";
  total_count: number;
  correct_count: number | null;
  score: number | null;
  questions: AttemptQuestion[];
}

export interface AnswerResult {
  is_correct: boolean;
  correct_index: number;
  finished: boolean;
}

// 시험 이름. round_no 1~5는 응시 순서이고, 학생에게는 아래 이름으로 보여준다.
export const ROUND_TITLE: Record<number, string> = {
  1: "1차 시험",
  2: "1차 재시험",
  3: "2차 시험",
  4: "2차 재시험",
  5: "3차 재시험",
};

// 회차 이름. 6 이상은 복습(점수에 반영되지 않는 다시 풀기)이다.
export const roundTitle = (roundNo: number) => ROUND_TITLE[roundNo] ?? "복습";

// 재시험(틀린 것만 다시 푸는 시험) 안내 문구. 단어는 "단어", 나머지 유형은 "문제".
export function retestDescription(roundNo: number, kind: TestKind = "vocab"): string | undefined {
  const noun = kind === "vocab" ? "단어" : "문제";
  const text: Record<number, string> = {
    2: `1차 시험에서 틀린 ${noun}만 다시 풀어요`,
    4: `2차 시험에서 틀린 ${noun}만 다시 풀어요`,
    5: `1차·2차 시험에서 모두 틀린 ${noun}만 마지막으로 다시 풀어요`,
  };
  return text[roundNo];
}

// 단어 시험의 재시험 안내 문구(기존 호출용).
export const RETEST_DESCRIPTION: Record<number, string> = {
  2: retestDescription(2)!,
  4: retestDescription(4)!,
  5: retestDescription(5)!,
};

// 다음 시험을 시작하는 버튼 문구.
export function startLabel(roundNo: number, kind: TestKind = "vocab"): string {
  const noun = kind === "vocab" ? "단어" : "문제";
  return retestDescription(roundNo, kind)
    ? `틀린 ${noun} 다시 풀기 (${ROUND_TITLE[roundNo]})`
    : `${ROUND_TITLE[roundNo]} 시작`;
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

// 단어는 get_vocab_test_status, 어순/순서/문장 배열은 get_{kind}_test_status(같은 모양).
export const getTestStatus = (setId: string, kind: TestKind = "vocab") =>
  kind === "vocab"
    ? rpc<TestStatus>("get_vocab_test_status", { p_vocab_set_id: setId })
    : rpc<TestStatus>(`get_${kind}_test_status`, { p_set_id: setId });

export const startAttempt = (vocabSetId: string) =>
  rpc<string>("start_vocab_attempt", { p_vocab_set_id: vocabSetId });

// 단어 복습 시작(풀던 복습이 있으면 그 attempt id).
export const startReview = (vocabSetId: string) =>
  rpc<string>("start_vocab_review", { p_vocab_set_id: vocabSetId });

export const getAttempt = (attemptId: string) =>
  rpc<Attempt>("get_vocab_attempt", { p_attempt_id: attemptId });

export const answerQuestion = (
  attemptId: string,
  position: number,
  selectedIndex: number,
) =>
  rpc<AnswerResult>("answer_vocab_question", {
    p_attempt_id: attemptId,
    p_position: position,
    p_selected_index: selectedIndex,
  });

// DB 함수가 던지는 영문 메시지를 학생에게 보여줄 문구로 바꾼다.
export function friendlyTestError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("at least 4 distinct meanings")) {
    return "이 단어장은 서로 다른 뜻의 단어가 4개 이상 있어야 테스트할 수 있어요.";
  }
  if (message.includes("no further round")) {
    return "이미 모든 회차를 마쳤어요.";
  }
  if (message.includes("not assigned")) {
    return "이 단어장은 지금 볼 수 없어요.";
  }
  return "테스트를 불러오지 못했어요. 잠시 후 다시 시도해주세요.";
}
