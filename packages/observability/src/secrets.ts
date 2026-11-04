import { readFileSync } from 'node:fs';

/**
 * Reads a secret from a mounted file when `<NAME>_FILE` is set, otherwise from
 * the plain environment variable. This supports Docker secrets and Kubernetes
 * `secretKeyRef` volumes without committing values to `.env` files.
 */
export function loadSecret(name: string): string | undefined {
  const filePath = process.env[`${name}_FILE`];
  if (filePath && filePath.trim().length > 0) {
    try {
      const value = readFileSync(filePath, 'utf8').trim();
      if (value.length > 0) return value;
    } catch (error) {
      throw new Error(
        `Unable to read secret ${name} from ${filePath}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

export function requireSecret(name: string): string {
  const value = loadSecret(name);
  if (!value) {
    throw new Error(`Missing required secret ${name}. Set ${name} or ${name}_FILE.`);
  }
  return value;
}
