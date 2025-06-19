import {
  ExportedDeclarations,
  Project,
  SourceFile,
  SyntaxKind,
} from 'ts-morph';
import { Maybe } from 'yummies';

import path from 'node:path';

const removeUnusedTypesItteration = async ({ dir }: { dir: string }) => {
  // Создаем проект в памяти
  const project = new Project();

  // Добавляем все TS/TSX файлы из указанной директории
  project.addSourceFilesAtPaths([
    path.join(dir, '**/*.ts'),
    path.join(dir, '**/*.tsx'),
  ]);

  const sourceFiles = project.getSourceFiles();
  const typeDeclarations = new Map();
  const usedTypes = new Set<string>();
  let dataContractsSourceFile: Maybe<SourceFile>;

  // Шаг 1: Собираем все объявления типов
  for (const file of sourceFiles) {
    if (file.getFilePath().includes(`${dir}/data-contracts.ts`)) {
      dataContractsSourceFile = file;
    }

    // Интерфейсы
    for (const intf of file.getInterfaces()) {
      const name = intf.getName();
      typeDeclarations.set(name, {
        node: intf,
        file: file.getFilePath(),
        line: intf.getStartLineNumber(),
      });
    }

    // Type-алиасы
    for (const typeAlias of file.getTypeAliases()) {
      const name = typeAlias.getName();
      typeDeclarations.set(name, {
        node: typeAlias,
        file: file.getFilePath(),
        line: typeAlias.getStartLineNumber(),
      });
    }
  }

  // Шаг 2: Ищем использования типов
  for (const file of sourceFiles) {
    // Проверяем все идентификаторы в файле
    const identifiers = file.getDescendantsOfKind(SyntaxKind.Identifier);

    for (const identifier of identifiers) {
      const name = identifier.getText();

      if (typeDeclarations.has(name)) {
        const parent = identifier.getParent();
        const declaration = typeDeclarations.get(name).node;

        // Игнорируем само объявление типа
        const isDeclaration = parent === declaration;

        // Игнорируем экспорт типа
        const isExport = parent?.getKind() === SyntaxKind.ExportSpecifier;

        if (!isDeclaration && !isExport) {
          usedTypes.add(name);
        }
      }
    }
  }

  if (!dataContractsSourceFile) {
    return;
  }

  let removedCount = 0;

  const exportedDeclarations =
    dataContractsSourceFile.getExportedDeclarations();

  // Шаг 3: Фильтруем неиспользуемые типы
  for (const [name] of typeDeclarations) {
    if (!usedTypes.has(name) && exportedDeclarations.has(name)) {
      const declarations = exportedDeclarations.get(name);

      declarations?.forEach((declaration: ExportedDeclarations) => {
        if ('remove' in declaration) {
          declaration.remove();
          removedCount++;
        }
      });
    }
  }

  if (removedCount > 0) {
    dataContractsSourceFile.saveSync();
  }
};

export const removeUnusedTypes = async ({ dir }: { dir: string }) => {
  const itterations = Array.from({ length: 3 })
    .fill(null)
    // eslint-disable-next-line unicorn/consistent-function-scoping
    .map(() => () => removeUnusedTypesItteration({ dir }));

  for await (const itteration of itterations) {
    itteration();
  }
};
