import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import type { EnvironmentConfig } from '@qa-agent/core';

interface RawEnvironmentConfig {
  name?: unknown;
  adapter?: unknown;
  baseUrl?: unknown;
  headless?: unknown;
  adapterOptions?: unknown;
}

async function isDirectory(dirPath: string): Promise<boolean> {
  try {
    return (await stat(dirPath)).isDirectory();
  } catch {
    return false;
  }
}

/** Walks upward from `startDir` looking for a directory named `dirName`, the way `git` finds `.git`. */
export async function findDirUpward(startDir: string, dirName: string): Promise<string> {
  let current = path.resolve(startDir);
  while (true) {
    const candidate = path.join(current, dirName);
    if (await isDirectory(candidate)) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(`Could not find a "${dirName}" directory above ${startDir}`);
    }
    current = parent;
  }
}

export async function loadEnvironmentConfig(
  environmentsDir: string,
  envName: string,
): Promise<EnvironmentConfig> {
  const configPath = path.join(environmentsDir, `${envName}.json`);
  const raw = JSON.parse(await readFile(configPath, 'utf8')) as RawEnvironmentConfig;

  if (typeof raw.name !== 'string' || typeof raw.adapter !== 'string') {
    throw new Error(`${configPath}: "name" and "adapter" must be strings`);
  }

  return {
    name: raw.name,
    adapter: raw.adapter,
    baseUrl: typeof raw.baseUrl === 'string' ? raw.baseUrl : undefined,
    headless: typeof raw.headless === 'boolean' ? raw.headless : undefined,
    adapterOptions:
      typeof raw.adapterOptions === 'object' && raw.adapterOptions !== null
        ? (raw.adapterOptions as Record<string, unknown>)
        : undefined,
    configDir: environmentsDir,
  };
}
