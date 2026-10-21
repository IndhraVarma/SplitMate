const PATHS = {
  dashboard: 'M4 13h6V4H4v9zm0 7h6v-5H4v5zm10 0h6V11h-6v9zm0-16v5h6V4h-6z',
  transactions: 'M8 7h12m0 0l-3-3m3 3l-3 3M16 17H4m0 0l3 3m-3-3l3-3',
  budgets: 'M4 19V9m6 10V5m6 14v-6M3 21h18',
  groups:
    'M17 20h5v-1a4 4 0 00-4-4M9 20H2v-1a5 5 0 015-5h2a5 5 0 015 5v1H9zm3-12a3 3 0 11-6 0 3 3 0 016 0zm7 1a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z',
  profile: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  plus: 'M12 5v14M5 12h14',
  back: 'M15 19l-7-7 7-7',
  balance: 'M12 3v18M5 7l7-3 7 3M3 11h6l-3 6-3-6zm12 0h6l-3 6-3-6z',
  settle: 'M20 6L9 17l-5-5',
  filter: 'M3 5h18M6 12h12M10 19h4',
  search: 'M21 21l-4.3-4.3M17 10a7 7 0 11-14 0 7 7 0 0114 0z',
  edit: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.4-9.4a2 2 0 112.8 2.8L12 16l-4 1 1-4 9.6-9.6z',
  trash: 'M4 7h16M10 11v6M14 11v6M5 7l1 13a2 2 0 002 2h8a2 2 0 002-2l1-13M9 7V4h6v3',
  logout: 'M17 16l4-4m0 0l-4-4m4 4H9m3 8H6a2 2 0 01-2-2V6a2 2 0 012-2h6',
  invite: 'M16 11V7a4 4 0 10-8 0v4M5 11h14v10H5V11z',
  copy: 'M8 8V5a2 2 0 012-2h9a2 2 0 012 2v9a2 2 0 01-2 2h-3M5 8h9a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2v-9a2 2 0 012-2z',
};

export default function NavIcon({ name, className = 'h-5 w-5', strokeWidth = 1.8 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={PATHS[name] || PATHS.dashboard} />
    </svg>
  );
}
