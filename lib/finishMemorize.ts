import { router } from "expo-router";
import { confirmChoice } from "./confirm";
import { getTestStatus, roundTitle } from "./test";
import { testRoute, type TestKind } from "./weekly";

// 암기를 마치면 바로 시험을 볼지 묻는다.
//  - 예: 내 진행에 맞는 회차(1차 시험, 재시험, 2차 시험…)가 강조된 시험 화면으로 간다.
//    암기 화면은 닫고 이동해서, 시험 화면에서 뒤로 오면 학습 목록으로 돌아온다.
//  - 아니오: 학습 목록으로 돌아간다.
export async function finishMemorize(kind: TestKind, setId: string) {
  let message = "암기를 마쳤어요. 이어서 시험을 보시겠어요?";
  try {
    const status = await getTestStatus(setId, kind);
    const round = status.rounds.find((r) => r.status === "in_progress")?.round_no ?? status.next_round;
    if (round) {
      message = `암기를 마쳤어요. 이어서 ${roundTitle(round)}을 보시겠어요?`;
    } else if (status.review?.available) {
      message = "암기를 마쳤어요. 이어서 복습 시험을 보시겠어요?";
    }
  } catch {
    // 회차를 확인하지 못해도 묻는 건 그대로 한다.
  }

  const yes = await confirmChoice("시험을 보시겠어요?", message, "예", "아니오");
  if (yes) {
    router.replace(testRoute(kind, setId));
  } else if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(`/learn/${kind}`);
  }
}
