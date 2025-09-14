import path from 'node:path';
import { type ExportedDeclarations, Node, Project, SyntaxKind } from 'ts-morph';

export interface RemoveUnusedTypesParams {
  directory: string;
  keepTypes?: RegExp | (RegExp | string)[];
}

const checkAbleToRemoveType = (
  typeName: string,
  keepTypes?: RemoveUnusedTypesParams['keepTypes'],
) => {
  if (!keepTypes) {
    return true;
  }

  const keepTypesArr = Array.isArray(keepTypes) ? keepTypes : [keepTypes];

  return keepTypesArr.every((keepTypeCheck) => {
    if (typeof keepTypeCheck === 'string') {
      return typeName !== keepTypeCheck;
    } else {
      return !keepTypeCheck.test(typeName);
    }
  });
};

const removeUnusedTypesItteration = async ({
  directory,
  keepTypes,
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <explanation>
}: RemoveUnusedTypesParams) => {
  const project = new Project();

  project.addSourceFilesAtPaths([
    path.join(directory, '**/*.ts'),
    path.join(directory, '**/*.tsx'),
  ]);

  const dataContractsSourceFile = project.getSourceFile((sourceFile) =>
    sourceFile.getFilePath().includes(`${directory}/data-contracts.ts`),
  );

  if (!dataContractsSourceFile) return;

  const exportedDeclarations =
    dataContractsSourceFile.getExportedDeclarations();
  const candidateTypes = new Map<string, ExportedDeclarations[]>();

  for (const [name, declarations] of exportedDeclarations) {
    const validDeclarations = declarations.filter(
      (decl) =>
        decl.getKind() === SyntaxKind.InterfaceDeclaration ||
        decl.getKind() === SyntaxKind.TypeAliasDeclaration ||
        decl.getKind() === SyntaxKind.EnumDeclaration,
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

    const memberAccessExpressions = file.getDescendantsOfKind(
      SyntaxKind.PropertyAccessExpression,
    );
    for (const expr of memberAccessExpressions) {
      const expression = expr.getExpression();
      if (Node.isIdentifier(expression)) {
        const name = expression.getText();
        if (candidateTypes.has(name)) {
          usedTypes.add(name);
        }
      }
    }
  }

  const dependencyGraph = new Map<string, Set<string>>();

  for (const [name, declarations] of candidateTypes) {
    const dependencies = new Set<string>();

    for (const decl of declarations) {
      const typeReferences = decl.getDescendantsOfKind(
        SyntaxKind.TypeReference,
      );
      for (const ref of typeReferences) {
        const typeName = ref.getTypeName().getText();
        if (candidateTypes.has(typeName)) {
          dependencies.add(typeName);
        }
      }

      if (decl.getKind() === SyntaxKind.EnumDeclaration) {
        const initializers = decl.getDescendantsOfKind(SyntaxKind.Identifier);
        for (const init of initializers) {
          const text = init.getText();
          if (candidateTypes.has(text)) {
            dependencies.add(text);
          }
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
      if ('remove' in decl && checkAbleToRemoveType(name, keepTypes)) {
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

export const removeUnusedTypes = async (params: RemoveUnusedTypesParams) => {
  while (true) {
    const removedCount = (await removeUnusedTypesItteration(params)) ?? 0;
    if (removedCount === 0) break;
  }
};
