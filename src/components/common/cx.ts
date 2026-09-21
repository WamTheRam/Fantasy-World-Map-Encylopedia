/** Joins class names, skipping falsy values: cx('a', isOn && 'b') */
export const cx = (...names: Array<string | false | null | undefined>): string => names.filter(Boolean).join(' ');
