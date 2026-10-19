import "../global.css";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { FONT } from "../components/AppText";

export default function RootLayout() {
  // 앱 글꼴(Pretendard)을 불러온 뒤에 화면을 그린다.
  const [fontsLoaded, fontError] = useFonts({
    [FONT.regular]: require("../assets/fonts/Pretendard-Regular.otf"),
    [FONT.medium]: require("../assets/fonts/Pretendard-Medium.otf"),
    [FONT.semibold]: require("../assets/fonts/Pretendard-SemiBold.otf"),
    [FONT.bold]: require("../assets/fonts/Pretendard-Bold.otf"),
    [FONT.extrabold]: require("../assets/fonts/Pretendard-ExtraBold.otf"),
  });

  // 글꼴을 못 불러와도(fontError) 시스템 글꼴로 앱은 계속 쓸 수 있게 한다.
  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}
