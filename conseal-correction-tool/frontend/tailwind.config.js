/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Risk tier colors — tune here, not in components
        risk: {
          high: "#ef4444",
          "high-bg": "#fef2f2",
          medium: "#f59e0b",
          "medium-bg": "#fffbeb",
          low: "#3b82f6",
          "low-bg": "#eff6ff",
        },
      },
    },
  },
  plugins: [],
};
