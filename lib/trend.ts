import type { CourseResults } from "./results";
import type { TestKind } from "./weekly";

// 성적 흐름 그래프의 한 주차 점. score는 그 주차에 끝낸 같은 유형 시험들의 종합 점수 평균(반올림),
// 끝낸 시험이 없으면 null(그래프에서 선이 끊긴다).
export interface TrendPoint {
  week: number;
  score: number | null;
  // 점수에 들어간 시험 수.
  count: number;
  // 지각이나 기한 초과로 본 시험이 있는지.
  late: boolean;
}

// 한 강좌에서 한 유형의 1주차부터 마지막 주차까지의 점수 흐름.
export function trendOf(course: CourseResults, kind: TestKind): TrendPoint[] {
  return Array.from({ length: course.totalWeeks }, (_, i) => {
    const week = i + 1;
    const tests = course.tests.filter((t) => t.kind === kind && t.week === week);
    const scored = tests.filter((t) => t.score !== null);
    return {
      week,
      score:
        scored.length === 0
          ? null
          : Math.round(scored.reduce((sum, t) => sum + (t.score ?? 0), 0) / scored.length),
      count: scored.length,
      late: scored.some((t) => t.timings.length > 0),
    };
  });
}

// 가장 최근 점수와 바로 앞 점수 대비 변화(점수가 하나뿐이면 delta는 null).
export function latestChange(points: TrendPoint[]) {
  const scored = points.filter((p) => p.score !== null);
  if (scored.length === 0) return null;
  const last = scored[scored.length - 1];
  const prev = scored.length > 1 ? scored[scored.length - 2] : null;
  return {
    week: last.week,
    score: last.score as number,
    delta: prev ? (last.score as number) - (prev.score as number) : null,
  };
}
