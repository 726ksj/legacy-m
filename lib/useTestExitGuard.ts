import { useEffect, useRef } from "react";
import { AppState, BackHandler } from "react-native";

// 앱을 나가 있어도 이 시간 안에 돌아오면 이어서 풀 수 있다(화면 꺼짐·짧은 앱 전환 구제).
export const EXIT_GRACE_MS = 60_000;

// 시험 도중 이탈 처리. active인 동안:
//  - 안드로이드 뒤로가기 버튼을 막는다(iOS 스와이프 뒤로가기는 화면에서 gestureEnabled로 막는다).
//  - 앱이 백그라운드로 간 뒤 EXIT_GRACE_MS(60초)가 지나면 onExit으로 지금 상태 그대로 제출한다.
//    60초 안에 돌아오면 이어서 푼다. 앱이 멈춰 있던 동안은 타이머가 못 돌 수 있어서, 돌아온
//    순간에도 나가 있던 시간을 재어 넘었으면 제출한다. 아예 꺼진 경우는 시험 현황 화면이 처리한다.
//  - 제출한 뒤 onLeft로 화면을 다시 불러 결과를 보여 준다.
//  - 화면이 닫히면(웹 뒤로가기 등) 바로 제출한다.
// onExit은 서버에서 여러 번 불려도 안전해야 한다(이미 끝난 시험이면 아무 일도 안 한다).
export function useTestExitGuard(
  active: boolean,
  onExit: () => Promise<unknown>,
  onLeft?: () => void,
) {
  const activeRef = useRef(active);
  const exitRef = useRef(onExit);
  const leftRef = useRef(onLeft);
  const submittedRef = useRef(false);
  const leftAtRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  activeRef.current = active;
  exitRef.current = onExit;
  leftRef.current = onLeft;

  useEffect(() => {
    if (active) submittedRef.current = false;
  }, [active]);

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
    const submit = () => {
      if (!activeRef.current || submittedRef.current) return;
      submittedRef.current = true;
      leftAtRef.current = null;
      clearTimer();
      exitRef
        .current()
        .catch(() => {})
        .finally(() => leftRef.current?.());
    };

    const backSub = BackHandler.addEventListener("hardwareBackPress", () => activeRef.current);

    const appSub = AppState.addEventListener("change", (state) => {
      if (state === "background") {
        if (!activeRef.current || leftAtRef.current !== null) return;
        leftAtRef.current = Date.now();
        clearTimer();
        timerRef.current = setTimeout(submit, EXIT_GRACE_MS);
      } else if (state === "active") {
        const leftAt = leftAtRef.current;
        leftAtRef.current = null;
        clearTimer();
        if (leftAt !== null && Date.now() - leftAt >= EXIT_GRACE_MS) submit();
      }
    });

    return () => {
      backSub.remove();
      appSub.remove();
      clearTimer();
      // 화면이 닫힐 때 아직 시험 중이면 그 상태로 제출한다.
      if (activeRef.current && !submittedRef.current) {
        submittedRef.current = true;
        exitRef.current().catch(() => {});
      }
    };
  }, []);
}
