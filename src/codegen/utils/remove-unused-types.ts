import { ExportedDeclarations, Project, SyntaxKind } from 'ts-morph';

import path from 'node:path';

const removeUnusedTypesItteration = async ({ dir }: { dir: string }) => {
  const project = new Project();

  project.addSourceFilesAtPaths([
    path.join(dir, '**/*.ts'),
    path.join(dir, '**/*.tsx'),
  ]);

  const dataContractsSourceFile = project.getSourceFile((sourceFile) =>
    sourceFile.getFilePath().includes(`${dir}/data-contracts.ts`),
  );

  if (!dataContractsSourceFile) return;

  const exportedDeclarations =
    dataContractsSourceFile.getExportedDeclarations();
  const candidateTypes = new Map<string, ExportedDeclarations[]>();

  for (const [name, declarations] of exportedDeclarations) {
    const validDeclarations = declarations.filter(
      (decl) =>
        decl.getKind() === SyntaxKind.InterfaceDeclaration ||
        decl.getKind() === SyntaxKind.TypeAliasDeclaration,
    );

    if (validDeclarations.length > 0) {
      candidateTypes.set(name, validDeclarations);
    }
  }

  if (candidateTypes.size === 0) return;

  const usedTypes = new Set<string>();
  const sourceFiles = project.getSourceFiles();

  for (const file of sourceFiles) {
    const identifiers = file.getDescendantsOfKind(SyntaxKind.Identifier);

    for (const identifier of identifiers) {
      const name = identifier.getText();

      if (!candidateTypes.has(name)) continue;

      if (file === dataContractsSourceFile) {
        const parent = identifier.getParent();

        const isDeclaration =
          parent?.getKind() === SyntaxKind.InterfaceDeclaration ||
          parent?.getKind() === SyntaxKind.TypeAliasDeclaration;

        const isExport = parent?.getKind() === SyntaxKind.ExportSpecifier;

        if (isDeclaration || isExport) continue;
      }

      usedTypes.add(name);
    }
  }

  let removedCount = 0;

  for (const [name, declarations] of candidateTypes) {
    if (usedTypes.has(name)) continue;

    for (const decl of declarations) {
      if ('remove' in decl) {
        decl.remove();
        removedCount++;
      }
    }
  }

  if (removedCount > 0) {
    await dataContractsSourceFile.save();
  }

  return removedCount;
};

export const removeUnusedTypes = async ({ dir }: { dir: string }) => {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const removedCount = (await removeUnusedTypesItteration({ dir })) ?? 0;
    if (removedCount === 0) break;
  }
};
