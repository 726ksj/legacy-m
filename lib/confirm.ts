import { Alert, Platform } from "react-native";

// 예/아니오를 묻는 팝업. 앱은 Alert, 웹은 브라우저 확인창(Alert.alert가 웹에서는 동작하지 않는다).
// 웹 확인창은 버튼 글자를 바꿀 수 없어서 "확인 = 예, 취소 = 아니오"로 안내 문구에 덧붙인다.
export function confirmChoice(
  title: string,
  message: string,
  yesLabel = "예",
  noLabel = "아니오",
): Promise<boolean> {
  if (Platform.OS === "web") {
    return Promise.resolve(
      window.confirm(`${title}\n\n${message}\n\n(확인 = ${yesLabel}, 취소 = ${noLabel})`),
    );
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: noLabel, style: "cancel", onPress: () => resolve(false) },
        { text: yesLabel, onPress: () => resolve(true) },
      ],
      { cancelable: false },
    );
  });
}
