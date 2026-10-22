/** @type {import('tailwindcss').Config} */
// 색상은 LEGACY M 로고에서 가져왔다: 분홍 그라데이션(brand), 와인색 글자(berry),
// 크림색 뇌(cream), 연한 분홍 배경(blush).
module.exports = {
  // 웹에서 NativeWind가 'media' 모드일 때 색상 모드를 설정하다 오류가 나서 class 방식으로 둔다(앱은 라이트 고정).
  darkMode: "class",
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // 앱 전체 글자 크기 단계. 기본값과 거의 같게 두고 큰 제목만 조금 줄였다.
      fontSize: {
        xs: ["12px", { lineHeight: "17px" }],
        sm: ["14px", { lineHeight: "20px" }],
        base: ["16px", { lineHeight: "23px" }],
        lg: ["18px", { lineHeight: "26px" }],
        xl: ["20px", { lineHeight: "28px" }],
        "2xl": ["23px", { lineHeight: "30px" }],
        "3xl": ["27px", { lineHeight: "34px" }],
      },
      colors: {
        brand: {
          DEFAULT: "#e27295",
          dark: "#c9557b",
          light: "#fef0f5",
        },
        berry: "#90243b",
        cream: "#fde2b9",
        blush: "#fef0f5",
        line: "#f6dde5",
        ink: {
          DEFAULT: "#3a1b25",
          soft: "#8c6b76",
        },
      },
    },
  },
  plugins: [],
};
