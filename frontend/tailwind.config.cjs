const defaultTheme = require("tailwindcss/defaultTheme");

module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Inter var'", ...defaultTheme.fontFamily.sans]
      },
      colors: {
        brand: {
          50: "#f5f8ff",
          100: "#e6edff",
          200: "#c7d4ff",
          300: "#a4b8ff",
          400: "#7b91ff",
          500: "#5a6cff",
          600: "#3144ff",
          700: "#1325f0",
          800: "#0f1cc0",
          900: "#0d1997"
        }
      },
      boxShadow: {
        "neon-ring": "0 0 35px rgba(90,108,255,0.35)",
        "frost": "0 10px 40px rgba(15,28,192,0.18)"
      },
      backgroundImage: {
        "grid-glow": "radial-gradient(circle at 20% 20%, rgba(90,108,255,0.18), transparent 35%), radial-gradient(circle at 80% 20%, rgba(19,37,240,0.22), transparent 40%)"
      }
    }
  },
  plugins: []
};
