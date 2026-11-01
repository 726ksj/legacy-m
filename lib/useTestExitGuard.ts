import { useEffect, useRef } from "react";
import { AppState, BackHandler } from "react-native";

// 시험 도중 이탈 처리. active인 동안:
//  - 안드로이드 뒤로가기 버튼을 막는다(iOS 스와이프 뒤로가기는 화면에서 gestureEnabled로 막는다).
//  - 앱이 백그라운드로 가면(앱 전환·홈·화면 잠금, 웹은 탭 숨김) onExit으로 지금 상태 그대로 제출하고
//    onLeft로 화면을 다시 불러 결과를 보여 준다.
//  - 화면이 닫히면(웹 뒤로가기 등) 마찬가지로 제출한다.
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
  activeRef.current = active;
  exitRef.current = onExit;
  leftRef.current = onLeft;

  useEffect(() => {
    if (active) submittedRef.current = false;
  }, [active]);

  useEffect(() => {
    const backSub = BackHandler.addEventListener("hardwareBackPress", () => activeRef.current);

    const appSub = AppState.addEventListener("change", (state) => {
      if (state !== "background" || !activeRef.current || submittedRef.current) return;
      submittedRef.current = true;
      exitRef
        .current()
        .catch(() => {})
        .finally(() => leftRef.current?.());
    });

    return () => {
      backSub.remove();
      appSub.remove();
      // 화면이 닫힐 때 아직 시험 중이면 그 상태로 제출한다.
      if (activeRef.current && !submittedRef.current) {
        submittedRef.current = true;
        exitRef.current().catch(() => {});
      }
    };
  }, []);
}
