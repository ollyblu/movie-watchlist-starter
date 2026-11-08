/** An error that is safe to show to the client. Anything else becomes a generic 500. */
export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const isUniqueViolation = (err) =>
  String(err?.code ?? '').startsWith('SQLITE_CONSTRAINT') && /UNIQUE/i.test(err.message);
