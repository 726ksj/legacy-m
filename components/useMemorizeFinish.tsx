import { useCallback, useState } from "react";
import { router } from "expo-router";
import ConfirmModal from "./ConfirmModal";
import { getTestStatus, roundTitle } from "../lib/test";
import { testRoute, type TestKind } from "../lib/weekly";

// 암기를 마치면 바로 시험을 볼지 묻는다.
//  - 예: 내 진행에 맞는 회차(1차 시험, 재시험, 2차 시험…)가 강조된 시험 화면으로 간다.
//    암기 화면은 닫고 이동해서, 시험 화면에서 뒤로 오면 학습 목록으로 돌아온다.
//  - 아니오: 학습 목록으로 돌아간다.
// finish를 암기 화면의 [완료]에 연결하고, finishPrompt를 화면 안에 그린다.
export function useMemorizeFinish(kind: TestKind, setId: string) {
  const [message, setMessage] = useState<string | null>(null);

  const finish = useCallback(async () => {
    let text = "암기를 마쳤어요.\n이어서 시험을 보시겠어요?";
    try {
      const status = await getTestStatus(setId, kind);
      const round =
        status.rounds.find((r) => r.status === "in_progress")?.round_no ?? status.next_round;
      if (round) {
        text = `암기를 마쳤어요.\n이어서 ${roundTitle(round)}을 보시겠어요?`;
      } else if (status.review?.available) {
        text = "암기를 마쳤어요.\n이어서 복습 시험을 보시겠어요?";
      }
    } catch {
      // 회차를 확인하지 못해도 묻는 건 그대로 한다.
    }
    setMessage(text);
  }, [kind, setId]);

  const onYes = () => {
    setMessage(null);
    router.replace(testRoute(kind, setId));
  };

  const onNo = () => {
    setMessage(null);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(`/learn/${kind}`);
    }
  };

  const finishPrompt = (
    <ConfirmModal visible={message !== null} message={message ?? ""} onYes={onYes} onNo={onNo} />
  );

  return { finish, finishPrompt };
}
