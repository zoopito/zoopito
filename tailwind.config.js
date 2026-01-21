/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    ".//views/**/*.ejs", // scan all ejs files inside views folder
    "./public/**/*.js", // scan js files
    "./*.html", // scan html at root (if index.html exists)
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
