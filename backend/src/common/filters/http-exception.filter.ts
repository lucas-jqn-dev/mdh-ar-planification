import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

const INTERNAL_SERVER_ERROR_STATUS: number = HttpStatus.INTERNAL_SERVER_ERROR;

interface ErrorResponseBody {
  status: number;
  code: string;
  message: string | string[];
  timestamp: string;
  path: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status: number = isHttpException
      ? exception.getStatus()
      : INTERNAL_SERVER_ERROR_STATUS;

    const message = this.extractMessage(exception, isHttpException);
    const code = isHttpException
      ? (HttpStatus[status] ?? 'HTTP_ERROR')
      : 'INTERNAL_SERVER_ERROR';

    const body: ErrorResponseBody = {
      status,
      code,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (status >= INTERNAL_SERVER_ERROR_STATUS) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json(body);
  }

  private extractMessage(
    exception: unknown,
    isHttpException: boolean,
  ): string | string[] {
    if (isHttpException) {
      const response = (exception as HttpException).getResponse();
      if (typeof response === 'string') {
        return response;
      }
      if (
        typeof response === 'object' &&
        response !== null &&
        'message' in response
      ) {
        return (response as { message: string | string[] }).message;
      }
    }
    return 'Internal server error';
  }
}
