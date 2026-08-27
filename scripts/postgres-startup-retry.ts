import { closePostgresPool } from "../lib/server/postgres-pool";

interface PostgresStartupRetryOptions {
  attempts?: number;
  baseDelayMillis?: number;
}

function wait(delayMillis: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, delayMillis));
}

export async function runPostgresStartupStep<T>(
  label: string,
  action: () => Promise<T>,
  options: PostgresStartupRetryOptions = {},
): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? 4);
  const baseDelayMillis = Math.max(0, options.baseDelayMillis ?? 1_500);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      // A timed-out pool may retain failed connection state. Recreate it on
      // the next attempt rather than retrying through the same pool instance.
      await closePostgresPool();
      if (attempt === attempts) throw error;

      const delayMillis = baseDelayMillis * 2 ** (attempt - 1);
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `${label} attempt ${attempt} of ${attempts} failed (${message}). Retrying in ${delayMillis}ms.`,
      );
      await wait(delayMillis);
    }
  }

  throw new Error(`${label} did not complete.`);
}
