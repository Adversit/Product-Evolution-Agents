/** @type {import('tailwindcss').Config} */
// Dark-tech tokens from the EvoPM Pipeline Observatory design brief (design_handoff_demo.md §视觉 Token).
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#0B0E14", // 背景
        panel: "#11161F", // 面板
        card: "#161C28", // 卡
        hairline: "#232A36", // 边框
        // 状态色
        active: "#22D3EE", // 进行中/活跃 青
        "active-soft": "#67e8f9",
        done: "#34D399", // 成功 翠
        "done-soft": "#6ee7b7",
        warn: "#FBBF24", // 警告 琥珀
        "warn-soft": "#fcd34d",
        danger: "#FB7185", // 错误/违规 玫红
        "danger-soft": "#fda4af",
        loop: "#A78BFA", // 回炉/重入 紫
        "loop-soft": "#c4b5fd",
        // 文本
        ink: "#E5E7EB",
        "ink-2": "#9CA3AF",
        "ink-3": "#6B7280",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
