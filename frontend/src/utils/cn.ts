/** Join truthy class names into a single string. Lightweight clsx replacement. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
