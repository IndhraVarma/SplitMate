/** The two glyphs that sit beside the sign-in fields. */
const PATHS = {
  at: 'M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-5.5 8.3',
  lock: 'M8 11V7a4 4 0 118 0v4M6 11h12v9H6v-9z',
  user: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
};

export default function AuthIcon({ name, className = 'h-5 w-5' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={PATHS[name] || PATHS.at} />
    </svg>
  );
}
