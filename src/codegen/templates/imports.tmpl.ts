import type { MaybeFalsy } from 'yummies/types';

export const DATA_CONTRACT_IMPORT_TOKEN = '/*__DATA_CONTRACT_IMPORTS__*/';

export interface ImportTmplEntry {
  what: MaybeFalsy<string | MaybeFalsy<string>[]>;
  from?: MaybeFalsy<string>;
}

export interface ImportsTmplConfig {
  imports: MaybeFalsy<string | ImportTmplEntry>[];
}

function resolveWhat(
  what: MaybeFalsy<string | MaybeFalsy<string>[]>,
): string | null {
  if (!what) {
    return null;
  }
  if (Array.isArray(what)) {
    const bindings = what.filter((x): x is string => Boolean(x)).join(', ');
    // Empty or all-falsy arrays → skip import (no `.length` check at call sites).
    return bindings || null;
  }
  return String(what);
}

function renderImportLine(what: string, from: string): string | null {
  const trimmedWhat = what.trim();

  if (trimmedWhat.startsWith('/*') && trimmedWhat.endsWith('*/')) {
    // this is special placeholder for further replacements.
    // It should be exist in output template
    return trimmedWhat;
  }

  if (!from) {
    return null;
  }

  if (trimmedWhat.startsWith('*')) {
    return `import ${what} from "${from}";`;
  }
  return `import { ${what} } from "${from}";`;
}

export const importsTmpl = ({ imports }: ImportsTmplConfig) =>
  imports
    .filter((it): it is string | ImportTmplEntry => Boolean(it))
    .map((it) => (typeof it === 'string' ? { what: it } : it))
    .map(({ what, from }) => {
      const resolvedWhat = resolveWhat(what);
      if (!resolvedWhat) {
        return null;
      }
      return renderImportLine(resolvedWhat, from ? String(from) : '');
    })
    .filter((line): line is string => Boolean(line))
    .join('\n');
