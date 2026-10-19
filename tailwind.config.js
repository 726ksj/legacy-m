/** @type {import('tailwindcss').Config} */
// 색상은 LEGACY M 로고에서 가져왔다: 분홍 그라데이션(brand), 와인색 글자(berry),
// 크림색 뇌(cream), 연한 분홍 배경(blush).
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // 앱 전체 글자 크기를 한 단계씩 키운다(기본값 대비 +1~4px).
      fontSize: {
        xs: ["13px", { lineHeight: "18px" }],
        sm: ["15px", { lineHeight: "21px" }],
        base: ["17px", { lineHeight: "24px" }],
        lg: ["19px", { lineHeight: "27px" }],
        xl: ["22px", { lineHeight: "30px" }],
        "2xl": ["26px", { lineHeight: "34px" }],
        "3xl": ["32px", { lineHeight: "40px" }],
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
