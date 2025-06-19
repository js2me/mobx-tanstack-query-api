/* eslint-disable no-constant-condition */
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
  const externalFiles = project
    .getSourceFiles()
    .filter((sf) => sf !== dataContractsSourceFile);

  for (const file of externalFiles) {
    const identifiers = file.getDescendantsOfKind(SyntaxKind.Identifier);

    for (const identifier of identifiers) {
      const name = identifier.getText();
      if (candidateTypes.has(name)) {
        usedTypes.add(name);
      }
    }
  }

  const dependencyGraph = new Map<string, Set<string>>();

  for (const [name, declarations] of candidateTypes) {
    const dependencies = new Set<string>();

    for (const decl of declarations) {
      const identifiers = decl.getDescendantsOfKind(SyntaxKind.Identifier);

      for (const ident of identifiers) {
        const refName = ident.getText();
        if (candidateTypes.has(refName)) {
          dependencies.add(refName);
        }
      }
    }

    dependencyGraph.set(name, dependencies);
  }

  const queue = Array.from(usedTypes);
  const visited = new Set(usedTypes);

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (dependencyGraph.has(current)) {
      for (const dep of dependencyGraph.get(current)!) {
        if (!visited.has(dep)) {
          visited.add(dep);
          usedTypes.add(dep);
          queue.push(dep);
        }
      }
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
  while (true) {
    const removedCount = (await removeUnusedTypesItteration({ dir })) ?? 0;
    if (removedCount === 0) break;
  }
};
