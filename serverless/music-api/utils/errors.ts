/**
 * Error handling utilities for Music API
 */

export interface RFC7807Error {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
}

export function createError(
  request: Request,
  status: number,
  title: string,
  detail: string
): RFC7807Error {
  return {
    type: `https://tools.ietf.org/html/rfc7231#section-6.5.${status}`,
    title,
    status,
    detail,
    instance: request.url,
  };
}
