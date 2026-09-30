// Request bounds shared by the server's validation and the composer UI. The server enforces them;
// the client uses them only to warn early.

export const REQUEST_LIMITS = {
  /** Longest single message, in UTF-16 code units (what a textarea's maxLength counts). */
  maxMessageChars: 4_000,
  /** Most messages accepted in one request: 12 user turns plus 11 earlier replies. */
  maxMessages: 23,
  /** Largest request body accepted, in bytes. */
  maxBodyBytes: 128 * 1024,
  /** IDs are client-generated; keep them short and URL-safe. */
  idPattern: /^[A-Za-z0-9_-]{8,64}$/,
} as const;
