/** @type {import('tailwindcss').Config} */
module.exports = {
  // IMPORTANT: Configure files to scan for Tailwind classes
  // This tells Tailwind where to look for your utility classes to generate the CSS.
  content: [
    "./src/**/*.{js,jsx,ts,tsx}", // Scans all JS/JSX/TS/TSX files in the src/ directory
    "./public/index.html",        // Scans your public HTML file (though less common for React components)
  ],
  theme: {
    extend: {
      // You can extend Tailwind's default theme here
      fontFamily: {
        // Define 'Inter' font. Make sure 'Inter' is available (e.g., via Google Fonts in public/index.html)
        inter: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        '3xl': '1.5rem', // Custom rounded-3xl for consistency
        'xl': '0.75rem', // Custom rounded-xl for consistency
      }
    },
  },
  plugins: [],
}
