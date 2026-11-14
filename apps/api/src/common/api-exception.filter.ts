import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ApiError, ApiErrorCode } from '@vyra/validation';
import type { Request, Response } from 'express';
import { getRequestId } from './request-id.middleware.js';

const CODE_BY_STATUS: Readonly<Record<number, ApiErrorCode>> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  422: 'VALIDATION_FAILED',
  429: 'RATE_LIMITED',
  503: 'SERVICE_UNAVAILABLE',
};

type ErrorDetails = NonNullable<ApiError['error']['details']>;

function publicDetails(exception: HttpException): ErrorDetails | undefined {
  const body = exception.getResponse();
  if (typeof body !== 'object' || body === null || !('details' in body)) return undefined;
  const { details } = body;
  if (!Array.isArray(details)) return undefined;
  return details.filter(
    (d): d is ErrorDetails[number] =>
      typeof d === 'object' &&
      d !== null &&
      typeof d.path === 'string' &&
      typeof d.message === 'string',
  );
}

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';

function publicMessage(exception: HttpException): string {
  const body = exception.getResponse();
  if (typeof body === 'string') return body;
  if (typeof body === 'object' && body !== null && 'message' in body) {
    const { message } = body;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.filter((m) => typeof m === 'string').join('; ');
  }
  return exception.message;
}

/**
 * Converts every thrown error into the shared `ApiError` envelope.
 * Unexpected errors are logged with their stack but never described to the client.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const requestId = getRequestId(request);

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exposeMessage = isHttp && status < 500;

    if (!exposeMessage) {
      this.logger.error(
        { requestId, method: request.method, path: request.path, status },
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ApiError = {
      error: {
        code: CODE_BY_STATUS[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST'),
        message: exposeMessage ? publicMessage(exception) : GENERIC_MESSAGE,
        ...(exposeMessage && publicDetails(exception) ? { details: publicDetails(exception) } : {}),
        requestId,
      },
    };
    response.status(status).json(body);
  }
}
