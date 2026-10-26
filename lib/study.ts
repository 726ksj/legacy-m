import { fetchVocabOverview } from "./vocab";
import { fetchWritingGroups } from "./writing";
import { fetchOrderOverview } from "./order";
import { fetchSentenceOverview } from "./sentence";
import { fetchVocabStatuses } from "./progress";
import {
  fetchWeeklyCourses,
  type TestKind,
  type WeeklyCourse,
  type WeeklyTask,
} from "./weekly";

// 학습 유형별 화면 제목. 학습/학습 결과 등 여러 화면이 같은 이름을 쓴다.
export const KIND_TITLES: Record<TestKind, string> = {
  vocab: "단어(VOCA)",
  writing: "어순 배열",
  order: "순서 배열",
  sentence: "문장 배열",
};

export const KINDS: TestKind[] = ["vocab", "writing", "order", "sentence"];

export function isTestKind(value: string | undefined): value is TestKind {
  return KINDS.includes(value as TestKind);
}

export interface StudyItem {
  task: WeeklyTask;
  course: WeeklyCourse | null;
}

// 학습에 보여 줄 시험 목록: 강좌 시험 + 개인 배정 단어장. 모든 회차를 마친 시험은
// 학습에서 빠지고 학습 결과로 넘어간다.
export async function fetchStudyItems(): Promise<StudyItem[]> {
  const [courses, statuses, overview] = await Promise.all([
    fetchWeeklyCourses(),
    fetchVocabStatuses(),
    // 강좌 없이 개인에게 배정된 단어장도 학습에 함께 보여 준다.
    fetchVocabOverview(),
  ]);

  const fromCourses: StudyItem[] = courses.flatMap((course) =>
    course.tasks.map((task) => ({ task, course })),
  );
  const personal: StudyItem[] = overview.groups
    .filter((group) => group.key === "personal")
    .flatMap((group) => group.sets)
    .map((set) => ({
      course: null,
      task: {
        kind: "vocab" as const,
        id: set.id,
        title: set.title,
        week: set.week,
        status: statuses.get(set.id) ?? "not_started",
        is_late: false,
        is_overdue: false,
      },
    }));

  return [...fromCourses, ...personal].filter(({ task }) =>
    task.kind === "vocab"
      ? statuses.get(task.id) !== "completed"
      : task.status !== "completed",
  );
}

// 암기할 세트 목록(이미 시험을 마친 세트도 다시 외울 수 있다).
export interface MemorizeSet {
  id: string;
  title: string;
  week: number | null;
}

export async function fetchMemorizeSets(kind: TestKind): Promise<MemorizeSet[]> {
  if (kind === "vocab") {
    const overview = await fetchVocabOverview();
    return overview.groups.flatMap((group) =>
      group.sets.map((set) => ({ id: set.id, title: set.title, week: set.week })),
    );
  }
  if (kind === "writing") {
    const groups = await fetchWritingGroups();
    return groups.flatMap((group) =>
      group.sets.map((set) => ({ id: set.id, title: set.title, week: set.week })),
    );
  }
  const rows = kind === "order" ? await fetchOrderOverview() : await fetchSentenceOverview();
  return rows.map((row) => ({ id: row.id, title: row.title, week: row.week }));
}

// 암기 화면 경로. 단어는 기본 화면, 나머지 유형은 kind를 붙인다.
export function memorizeRoute(kind: TestKind, id: string) {
  return (kind === "vocab" ? `/memorize/${id}` : `/memorize/${id}?kind=${kind}`) as `/memorize/${string}`;
}
