import { Platform } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../lib/theme";
import { FONT } from "../../components/AppText";

export default function TabsLayout() {
  // 홈 바 같은 하단 안전 영역만큼 탭바를 키운다.
  const { bottom } = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandDark,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopWidth: 1,
          borderTopColor: colors.line,
          // 웹은 아이콘+글자가 62 안에 다 들어가지 않아 아래가 잘려서 조금 더 크게 잡는다.
          height: (Platform.OS === "web" ? 74 : 62) + bottom,
          paddingBottom: 8 + bottom,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 13, fontFamily: FONT.bold },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "홈",
          tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="study"
        options={{
          title: "학습",
          tabBarIcon: ({ color, size }) => <Ionicons name="book" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="wrong"
        options={{
          title: "오답",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="alert-circle" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="results"
        options={{
          title: "학습 결과",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "설정",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
