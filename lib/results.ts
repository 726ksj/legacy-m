import { supabase } from "./supabase";
import { fetchOrderOverview, type OrderOverviewRow } from "./order";
import { fetchWeeklyCourses, type TestKind } from "./weekly";
import type { SetStatus } from "./progress";

export interface TimingTag {
  label: string;
  kind: "late" | "overdue";
}

// 한 주차에 속한 시험 하나(단어장 또는 어순 배열 세트)와 내 결과.
export interface WeekTest {
  kind: TestKind;
  id: string;
  title: string;
  week: number | null;
  status: SetStatus;
  // 완료한 시험의 점수/세부/날짜. 아직 끝내지 않았으면 null.
  scoreLabel: string | null;
  detail: string | null;
  date: string | null;
  timings: TimingTag[];
}

export interface CourseResults {
  // 강좌 id. 강좌 없이 개인 배정된 단어장은 "personal".
  key: string;
  label: string;
  startDate: string | null;
  // 강사가 설정한 기간(주). 설정이 없으면 시험이 등록된 가장 큰 주차까지.
  totalWeeks: number;
  currentWeek: number | null;
  tests: WeekTest[];
}

export const PERSONAL_KEY = "personal";
// 주차가 지정되지 않은 시험을 모아 보는 주차 값.
export const NO_WEEK = 0;

interface VocabAssignmentRow {
  course_id: string | null;
  vocab_sets: { id: string; title: string; week: number | null } | null;
}

interface WritingSetRow {
  id: string;
  title: string;
  week: number | null;
  course_id: string;
}

const TIMING_LABEL = { late: "지각", overdue: "기한 초과" } as const;

const kindOf = (row: {
  is_late: boolean;
  is_overdue: boolean;
}): TimingTag["kind"] | null =>
  row.is_overdue ? "overdue" : row.is_late ? "late" : null;

// 단어 시험에서 기한이 걸린 회차(1차 시험, 2차 시험).
const EXAM_PREFIX: Record<number, string> = { 1: "1차 ", 3: "2차 " };

// 수강 중인 강좌별로 주차에 속한 모든 시험과 내 결과를 모아 온다.
export async function fetchCourseResults(): Promise<CourseResults[]> {
  const [
    courses,
    { data: assignments },
    { data: writingSets },
    { data: vocabResults },
    { data: writingResults },
    { data: vocabAttempts },
    { data: writingAttempts },
    orderOverview,
  ] = await Promise.all([
    fetchWeeklyCourses(),
    supabase
      .from("vocab_assignments")
      .select("course_id, vocab_sets(id, title, week)")
      .returns<VocabAssignmentRow[]>(),
    supabase
      .from("writing_sets")
      .select("id, title, week, course_id")
      .returns<WritingSetRow[]>(),
    supabase
      .from("vocab_test_results")
      .select("vocab_set_id, score, total_count, correct_count, tested_at")
      .order("tested_at", { ascending: false }),
    supabase
      .from("writing_set_completions")
      .select("writing_set_id, points, max_points, completed_at"),
    supabase
      .from("vocab_test_attempts")
      .select("vocab_set_id, round_no, is_late, is_overdue")
      .order("round_no", { ascending: true }),
    supabase
      .from("writing_attempts")
      .select("writing_set_id, is_late, is_overdue")
      .order("started_at", { ascending: true }),
    // 순서 배열은 정답이 걸려 있어 서버 함수로만 진행 상황을 받는다. 불러오지 못해도
    // 나머지 결과는 보여 준다.
    fetchOrderOverview().catch(() => [] as OrderOverviewRow[]),
  ]);

  const vocabResultBySet = new Map<
    string,
    { score: number; total: number; correct: number; at: string }
  >();
  for (const r of vocabResults ?? []) {
    if (!vocabResultBySet.has(r.vocab_set_id)) {
      vocabResultBySet.set(r.vocab_set_id, {
        score: r.score,
        total: r.total_count,
        correct: r.correct_count,
        at: r.tested_at,
      });
    }
  }
  const writingResultBySet = new Map(
    (writingResults ?? []).map((r) => [r.writing_set_id, r]),
  );

  // 응시 기록이 있는 세트(진행 중 판단)와 지각/기한 초과 표시.
  const vocabStarted = new Set<string>();
  const vocabTimings = new Map<string, TimingTag[]>();
  for (const row of vocabAttempts ?? []) {
    vocabStarted.add(row.vocab_set_id);
    if (row.round_no !== 1 && row.round_no !== 3) continue;
    const kind = kindOf(row);
    if (!kind) continue;
    const tags = vocabTimings.get(row.vocab_set_id) ?? [];
    tags.push({
      label: `${EXAM_PREFIX[row.round_no]}${TIMING_LABEL[kind]}`,
      kind,
    });
    vocabTimings.set(row.vocab_set_id, tags);
  }
  const writingStarted = new Set<string>();
  const writingTimings = new Map<string, TimingTag[]>();
  for (const row of writingAttempts ?? []) {
    if (writingStarted.has(row.writing_set_id)) continue;
    writingStarted.add(row.writing_set_id);
    const kind = kindOf(row);
    writingTimings.set(
      row.writing_set_id,
      kind ? [{ label: TIMING_LABEL[kind], kind }] : [],
    );
  }

  const vocabTest = (
    set: NonNullable<VocabAssignmentRow["vocab_sets"]>,
  ): WeekTest => {
    const result = vocabResultBySet.get(set.id);
    return {
      kind: "vocab",
      id: set.id,
      title: set.title,
      week: set.week,
      status: result
        ? "completed"
        : vocabStarted.has(set.id)
          ? "in_progress"
          : "not_started",
      scoreLabel: result ? `${result.score}점` : null,
      detail: result ? `${result.correct}/${result.total}개 정답` : null,
      date: result?.at ?? null,
      timings: vocabTimings.get(set.id) ?? [],
    };
  };

  const writingTest = (set: WritingSetRow): WeekTest => {
    const done = writingResultBySet.get(set.id);
    return {
      kind: "writing",
      id: set.id,
      title: set.title,
      week: set.week,
      status: done
        ? "completed"
        : writingStarted.has(set.id)
          ? "in_progress"
          : "not_started",
      scoreLabel: done ? `${done.points} / ${done.max_points}점` : null,
      detail: done ? "모든 문장 완성" : null,
      date: done?.completed_at ?? null,
      timings: writingTimings.get(set.id) ?? [],
    };
  };

  const orderTest = (row: OrderOverviewRow): WeekTest => {
    const kind = row.is_overdue ? "overdue" : row.is_late ? "late" : null;
    return {
      kind: "order",
      id: row.id,
      title: row.title,
      week: row.week,
      status: row.completed
        ? "completed"
        : row.answered > 0
          ? "in_progress"
          : "not_started",
      scoreLabel: row.completed ? `${row.score}점` : null,
      detail: row.completed ? `${row.correct}/${row.total}개 정답` : null,
      date: row.completed_at,
      timings: kind ? [{ label: TIMING_LABEL[kind], kind }] : [],
    };
  };

  const finish = (
    base: Omit<CourseResults, "totalWeeks" | "tests">,
    totalWeeks: number | null,
    tests: WeekTest[],
  ): CourseResults => ({
    ...base,
    totalWeeks: Math.max(
      totalWeeks ?? 0,
      ...tests.map((t) => t.week ?? 0),
    ),
    tests,
  });

  const result: CourseResults[] = courses.map((course) => {
    const tests: WeekTest[] = [
      ...(assignments ?? [])
        .filter((a) => a.course_id === course.course_id && a.vocab_sets)
        .map((a) => vocabTest(a.vocab_sets!)),
      ...(writingSets ?? [])
        .filter((s) => s.course_id === course.course_id)
        .map(writingTest),
      ...orderOverview
        .filter((o) => o.course_id === course.course_id)
        .map(orderTest),
    ];
    return finish(
      {
        key: course.course_id,
        label: `[${course.subject}] ${course.title}`,
        startDate: course.start_date,
        currentWeek: course.current_week,
      },
      course.total_weeks,
      tests,
    );
  });

  // 강좌 없이 개인에게 배정된 단어장.
  const personal = (assignments ?? [])
    .filter((a) => a.course_id === null && a.vocab_sets)
    .map((a) => vocabTest(a.vocab_sets!));
  if (personal.length > 0) {
    result.push(
      finish(
        {
          key: PERSONAL_KEY,
          label: "개인 배정 단어장",
          startDate: null,
          currentWeek: null,
        },
        null,
        personal,
      ),
    );
  }

  return result;
}

// 한 주차에 속한 시험. week가 NO_WEEK(0)이면 주차가 지정되지 않은 시험.
export const testsOfWeek = (course: CourseResults, week: number) =>
  course.tests
    .filter((t) => (t.week ?? NO_WEEK) === week)
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title));

// 강좌 시작일 기준 주차의 기간 "10.12 ~ 10.18". 시작일이 없으면 null.
export function weekRange(startDate: string | null, week: number) {
  if (!startDate) return null;
  const [y, m, d] = startDate.split("-").map(Number);
  const fmt = (offset: number) => {
    const date = new Date(Date.UTC(y, m - 1, d + offset));
    return `${String(date.getUTCMonth() + 1).padStart(2, "0")}.${String(
      date.getUTCDate(),
    ).padStart(2, "0")}`;
  };
  return `${fmt((week - 1) * 7)} ~ ${fmt((week - 1) * 7 + 6)}`;
}
