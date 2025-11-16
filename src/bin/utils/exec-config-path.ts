import { createJiti } from 'jiti';

export const execConfigPath = async (configPath: string) => {
  const jiti = createJiti(import.meta.url);

  try {
    const config = await jiti.import(configPath, { default: true });
    return config;
  } catch (error) {
    console.error(error);
  }

  throw new Error(
    `${configPath} is not valid, This file should return object - result of the defineConfig function`,
  );
};
