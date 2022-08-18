module.exports = {
  content: ["./app/**/*.{ts,tsx,jsx,js}"],
  darkMode: "class",
  theme: {
    screens: {
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
    },
    extend: {
      colors: {
        admiral: "#15c9bf",
        champions: "#c29f04",
        dragon: "#1f8b4c",
        galaxy: "#3498db",
        monarch: "#9b59b6",
        def: "rgba(134, 73, 53, 0.8)",
        qb: "rgba(129, 15, 57, 0.8)",
        rb: "rgba(13, 113, 83, 0.8)",
        te: "rgba(151, 79, 1, 0.8)",
        wr: "rgba(6, 109, 150, 0.8)",
      },
    },
  },
  plugins: [require("@tailwindcss/typography"), require("@tailwindcss/forms")],
};
