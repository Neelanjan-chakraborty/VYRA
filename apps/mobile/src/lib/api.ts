import {
  apiErrorSchema,
  authTokensSchema,
  type ApiError,
  type ApiErrorCode,
} from '@vyra/validation';
import type { z } from 'zod';
import { useSession } from './session';
import { tokenStorage } from './token-storage';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';
const REQUEST_TIMEOUT_MS = 15_000;
const UPLOAD_TIMEOUT_MS = 60_000;

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly code: ApiErrorCode | 'NETWORK' | 'MALFORMED_RESPONSE',
    readonly status?: number,
    readonly details: NonNullable<ApiError['error']['details']> = [],
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }

  /** The first server message for a form field, if the server reported one. */
  fieldError(path: string): string | undefined {
    return this.details.find((detail) => detail.path === path)?.message;
  }
}

/** What to show a person for any thrown value. */
export function errorMessage(error: unknown): string {
  return error instanceof ApiRequestError
    ? error.message
    : 'Something went wrong. Please try again.';
}

interface RequestOptions<Schema extends z.ZodType | undefined> {
  readonly method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** JSON body, or FormData for uploads. */
  readonly body?: unknown;
  /** Response schema. Omit for endpoints that return no content. */
  readonly schema?: Schema;
  /** Send the access token and refresh it once on 401. Default true. */
  readonly authenticated?: boolean;
  /** Non-2xx statuses whose body should still be parsed with the schema. */
  readonly acceptStatuses?: readonly number[];
}

type Result<Schema> = Schema extends z.ZodType ? z.infer<Schema> : void;

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Exchanges the refresh token for a new pair. Concurrent callers share one
 * request: the server revokes every session if a refresh token is used twice.
 */
export function refreshSession(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    const refreshToken = useSession.getState().refreshToken ?? (await tokenStorage.read());
    if (!refreshToken) return false;
    try {
      const response = await fetch(`${API_BASE_URL}/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ refreshToken }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        // Only a definite rejection ends the session; a server error does not.
        if (response.status === 401) await useSession.getState().clear();
        return false;
      }
      const tokens = authTokensSchema.parse(await response.json());
      await useSession.getState().setTokens(tokens);
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function send(
  path: string,
  options: RequestOptions<z.ZodType | undefined>,
): Promise<Response> {
  const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: Record<string, string> = { accept: 'application/json' };
  if (options.body !== undefined && !isForm) headers['content-type'] = 'application/json';
  const { accessToken } = useSession.getState();
  if (options.authenticated !== false && accessToken)
    headers.authorization = `Bearer ${accessToken}`;

  let body: BodyInit | undefined;
  if (isForm) body = options.body as FormData;
  else if (options.body !== undefined) body = JSON.stringify(options.body);

  try {
    return await fetch(`${API_BASE_URL}/v1${path}`, {
      method: options.method ?? 'GET',
      headers,
      body,
      signal: AbortSignal.timeout(isForm ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new ApiRequestError(
      'Could not reach VYRA. Check your connection and try again.',
      'NETWORK',
    );
  }
}

/**
 * Calls the API and validates the response against a shared schema, so a
 * server/client contract mismatch surfaces as an error instead of bad UI state.
 */
export async function api<Schema extends z.ZodType | undefined = undefined>(
  path: `/${string}`,
  options: RequestOptions<Schema> = {},
): Promise<Result<Schema>> {
  let response = await send(path, options);
  if (response.status === 401 && options.authenticated !== false && (await refreshSession())) {
    response = await send(path, options);
  }

  const payload: unknown =
    response.status === 204 ? undefined : await response.json().catch(() => undefined);

  if (!response.ok && !options.acceptStatuses?.includes(response.status)) {
    const parsed = apiErrorSchema.safeParse(payload);
    if (!parsed.success) {
      throw new ApiRequestError(
        'Unexpected response from VYRA.',
        'MALFORMED_RESPONSE',
        response.status,
      );
    }
    const { code, message, details } = parsed.data.error;
    throw new ApiRequestError(message, code, response.status, details);
  }

  if (!options.schema) return undefined as Result<Schema>;
  const result = options.schema.safeParse(payload);
  if (!result.success) {
    throw new ApiRequestError(
      'Unexpected response from VYRA.',
      'MALFORMED_RESPONSE',
      response.status,
    );
  }
  return result.data as Result<Schema>;
}
