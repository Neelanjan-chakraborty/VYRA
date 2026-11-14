import { apiErrorSchema, type ApiErrorCode } from '@vyra/validation';
import type { z } from 'zod';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';
const REQUEST_TIMEOUT_MS = 10_000;

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly code: ApiErrorCode | 'NETWORK' | 'MALFORMED_RESPONSE',
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

interface RequestOptions {
  /** HTTP statuses, besides 2xx, whose body should still be parsed with the schema. */
  readonly acceptStatuses?: readonly number[];
}

/**
 * GETs a versioned API path and validates the response against a shared schema,
 * so a server/client contract mismatch surfaces as an error instead of bad UI state.
 */
export async function apiGet<Schema extends z.ZodType>(
  path: `/${string}`,
  schema: Schema,
  options: RequestOptions = {},
): Promise<z.infer<Schema>> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/v1${path}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new ApiRequestError('Could not reach VYRA. Check your connection.', 'NETWORK');
  }

  const payload: unknown = await response.json().catch(() => undefined);

  if (!response.ok && !options.acceptStatuses?.includes(response.status)) {
    const parsed = apiErrorSchema.safeParse(payload);
    throw parsed.success
      ? new ApiRequestError(parsed.data.error.message, parsed.data.error.code, response.status)
      : new ApiRequestError(
          'Unexpected response from VYRA.',
          'MALFORMED_RESPONSE',
          response.status,
        );
  }

  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new ApiRequestError(
      'Unexpected response from VYRA.',
      'MALFORMED_RESPONSE',
      response.status,
    );
  }
  return result.data;
}
