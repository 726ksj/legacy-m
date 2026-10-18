import { supabase } from "./supabase";

export type TaskStatus = "not_started" | "in_progress" | "completed";

export interface WeeklyTask {
  kind: "vocab" | "writing";
  id: string;
  title: string;
  week: number | null;
  status: TaskStatus;
  // 주차 종료 후 5일 이내라 지금 응시하면 지각 응시가 되는 경우.
  is_late: boolean;
  // 주차 종료 후 5일이 지나 기한 초과로 표시되는 경우.
  is_overdue: boolean;
}

export interface WeeklyCourse {
  course_id: string;
  title: string;
  subject: string;
  start_date: string | null;
  total_weeks: number | null;
  // 강좌 시작일 기준 현재 주차. 시작일이 없으면 null.
  current_week: number | null;
  tasks: WeeklyTask[];
}

export async function fetchWeeklyCourses(): Promise<WeeklyCourse[]> {
  const { data, error } = await supabase.rpc("get_weekly_tasks");
  if (error) throw new Error(error.message);
  return (data ?? []) as WeeklyCourse[];
}

export interface WeeklySummary {
  // 이번 주 할 일(지각 응시 제외)의 전체/완료 개수.
  total: number;
  done: number;
  // 지난 주차에서 아직 끝내지 못한 시험 중 지각(5일 이내) 개수.
  lateCount: number;
  // 지난 주차에서 아직 끝내지 못한 시험 중 기한 초과 개수.
  overdueCount: number;
}

export function summarizeWeekly(courses: WeeklyCourse[]): WeeklySummary {
  const tasks = courses.flatMap((course) => course.tasks);
  const thisWeek = tasks.filter((task) => !task.is_late && !task.is_overdue);
  return {
    total: thisWeek.length,
    done: thisWeek.filter((task) => task.status === "completed").length,
    lateCount: tasks.filter((task) => task.is_late).length,
    overdueCount: tasks.filter((task) => task.is_overdue).length,
  };
}

export const KIND_LABEL: Record<WeeklyTask["kind"], string> = {
  vocab: "단어",
  writing: "서술형",
};

export const STATUS_LABEL: Record<TaskStatus, string> = {
  not_started: "미응시",
  in_progress: "진행 중",
  completed: "완료",
};

// 강좌의 현재 주차 마감(주차 마지막 날)까지 남은 기간. 시작일이나 주차를 알 수 없으면 null.
export function weekDeadline(
  course: Pick<WeeklyCourse, "start_date" | "current_week">,
): { label: string; urgent: boolean } | null {
  if (!course.start_date || course.current_week === null) return null;
  if (course.current_week < 1) return null;
  const [y, m, d] = course.start_date.split("-").map(Number);
  const end = Date.UTC(y, m - 1, d + course.current_week * 7 - 1);
  // 한국 시간(KST) 기준 오늘.
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const left = Math.round((end - today) / 86400000);
  return { label: left <= 0 ? "오늘 마감" : `D-${left}`, urgent: left <= 1 };
}
