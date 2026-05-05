export interface ParsedComponentRef {
  section: string;
  name: string;
}

export function parseComponentRef(ref: string): ParsedComponentRef | null {
  if (typeof ref !== 'string') {
    return null;
  }

  const match = ref.match(/^#\/components\/([^/]+)\/([^/]+)$/);
  if (!match) {
    return null;
  }

  return {
    section: match[1],
    name: match[2],
  };
}
