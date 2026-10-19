import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Text } from "./AppText";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { brandGradient } from "../lib/theme";

// 모든 화면이 쓰는 상단 헤더: 분홍 그라데이션 + 둥근 아래쪽 + 흰 제목.
// back을 켜면 왼쪽에 뒤로가기 버튼이 나오고, right에는 아이콘/상태 같은 보조
// 요소를 넣는다. 좌우 영역 폭을 같게 둬서 제목이 항상 가운데에 온다.
export default function ScreenHeader({
  title,
  back = false,
  right,
}: {
  title: string;
  back?: boolean;
  right?: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };

  return (
    <>
      {/* 헤더가 항상 분홍 배경이라 상태바 글자는 흰색으로 고정한다. */}
      <StatusBar style="light" />
      <LinearGradient
        colors={brandGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingTop: insets.top + 12,
          paddingBottom: 22,
          paddingHorizontal: 20,
          borderBottomLeftRadius: 32,
          borderBottomRightRadius: 32,
        }}
      >
        <View className="h-10 flex-row items-center">
          <View className="w-14 items-start">
            {back && (
              <Pressable
                onPress={goBack}
                hitSlop={8}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                className="h-9 w-9 items-center justify-center rounded-full bg-white/25"
              >
                <Ionicons name="chevron-back" size={22} color="white" />
              </Pressable>
            )}
          </View>
          <Text
            numberOfLines={1}
            className="flex-1 text-center text-xl font-extrabold tracking-wide text-white"
          >
            {title}
          </Text>
          <View className="w-14 items-end">{right}</View>
        </View>
      </LinearGradient>
    </>
  );
}
