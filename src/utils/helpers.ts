export function toSlug(str: string): string {
  return str.toLowerCase().replace(/\s+/g, "-");
}
