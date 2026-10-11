/**
 * Utility to convert standard digits (0-9) to Eastern Arabic (Hindi) numerals: ٠١٢٣٤٥٦٧٨٩
 */
export function toHindi(val: number | string | undefined | null): string {
  if (val === undefined || val === null) return '';
  return val.toString().replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[parseInt(d, 10)]);
}
