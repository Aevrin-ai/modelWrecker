// an API failure whose message is safe to show; `code` is the contract's error code
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  // the server's reference for this request, for support; null when it sent none
  readonly requestId: string | null;
  constructor(status: number, code: string, message: string, requestId: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}
