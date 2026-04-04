/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        claude: {
          bg: '#ffffff',
          sidebar: '#f7f7f8',
          border: '#e5e7eb',
          text: '#101010',
          secondary: '#6b7280',
          accent: '#7c3aed',
          hover: '#f3f4f6',
          input: '#f9fafb'
        }
      },
      fontFamily: {
        inter: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
