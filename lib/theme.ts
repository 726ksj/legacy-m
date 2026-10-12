// 화면 전반에서 쓰는 색상. 값은 tailwind.config.js와 같게 유지한다(NativeWind
// 클래스를 못 쓰는 곳: 그라데이션, 탭바, 네비게이션 헤더, 아이콘 색 등).
export const colors = {
  brand: "#e27295",
  brandDark: "#c9557b",
  blush: "#fef0f5",
  berry: "#90243b",
  cream: "#fde2b9",
  line: "#f6dde5",
  ink: "#3a1b25",
  inkSoft: "#8c6b76",
  inkMuted: "#b9a3ab",
} as const;

// 로고 아이콘의 분홍 그라데이션.
export const brandGradient = ["#eb89a8", "#df6e92"] as const;

// 학습 유형별 색(화면설계서 기준: 단어 민트, 서술형 분홍, 순서 파랑, 어법 보라).
// 카드/목록의 배경(bg), 글자(fg), 칩 배경(accent)에 같이 쓴다.
export const categoryColors = {
  vocab: { bg: "#e9f7f1", fg: "#1f8a5f", accent: "#cbeedd", border: "#a8dcc3" },
  writing: {
    bg: "#f9e0ea",
    fg: "#c23d64",
    accent: "#f3c4d4",
    border: "#eeaac1",
  },
  order: { bg: "#eaf1fb", fg: "#2f5fa8", accent: "#d3e1f5", border: "#b7cbe9" },
  grammar: {
    bg: "#f1eafb",
    fg: "#6c3fa8",
    accent: "#e1d4f5",
    border: "#cbb7e9",
  },
} as const;

export type CategoryKey = keyof typeof categoryColors;
