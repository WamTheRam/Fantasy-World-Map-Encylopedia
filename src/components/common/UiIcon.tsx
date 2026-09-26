/** Small stroke icons for interface chrome (not map markers; those live in components/map). */
const PATHS = {
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  recenter: 'M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6ZM12 2.5v3.2M12 18.3v3.2M2.5 12h3.2M18.3 12h3.2',
  chevronRight: 'M9.5 6l6 6-6 6',
  chevronLeft: 'M14.5 6l-6 6 6 6',
  chevronDown: 'M6 9.5l6 6 6-6',
  image: 'M4 5.5h16v13H4zM4 16l4.5-4.5 3.5 3.5 3-3L20 16.5',
  swap: 'M4 8h15M15.5 4.5 19 8l-3.5 3.5M20 16H5M8.5 12.5 5 16l3.5 3.5',
  pencil: 'M4 20l1-4.2L16.6 4.2a1.6 1.6 0 0 1 2.2 0l1 1a1.6 1.6 0 0 1 0 2.2L8.2 19 4 20zM14.5 6.3l3.2 3.2',
  home: 'M3.5 11.5 12 4l8.5 7.5M6 10v9.5h5V14h2v5.5h5V10',
  palette:
    'M12 3a9 9 0 1 0 9 9c0-1.1-.9-2-2-2h-2.2a2 2 0 0 1-2-2c0-.75.4-1.2.7-1.7.25-.4.5-.85.5-1.4A2 2 0 0 0 14 3.2 9 9 0 0 0 12 3ZM7.3 12.3a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2ZM9.6 8.4a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2ZM14.9 8.4a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2Z',
  trash:
    'M5 7h14M9.5 7V5.2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7m-8.5 0 .9 12.3a1 1 0 0 0 1 .9h7.2a1 1 0 0 0 1-.9L18.5 7M10.2 11v6M13.8 11v6',
} as const;

export type UiIconName = keyof typeof PATHS;

export function UiIcon({ name, size = 20 }: { name: UiIconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
