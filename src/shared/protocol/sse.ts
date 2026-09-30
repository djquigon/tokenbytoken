// Server-Sent Events framing, hand-written so it works over fetch() with a POST body (EventSource can't
// POST). The parser follows the WHATWG event-stream rules for the fields this app uses.

export interface SseMessage {
  readonly id: string | null;
  readonly event: string | null;
  readonly data: string;
}

/** A comment block that opens every stream. Safari buffers the first ~1 KB before showing anything. */
export const SSE_PADDING = `: ${' '.repeat(2048)}\n\n`;

export const SSE_HEADERS: Readonly<Record<string, string>> = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  'X-Accel-Buffering': 'no',
};

/** Serializes one message. JSON never contains raw newlines, so each message has one data line. */
export function formatSseMessage(id: number | null, data: string): string {
  if (/[\r\n]/.test(data)) throw new Error('SSE data must be a single line');
  return `${id === null ? '' : `id: ${id}\n`}data: ${data}\n\n`;
}

export const formatSseComment = (text: string): string => `: ${text.replace(/[\r\n]/g, ' ')}\n\n`;

/**
 * Incremental parser. Feed decoded text in any chunking; complete messages come out in order.
 * Handles LF, CR, and CRLF line endings, a CRLF split across chunks, comments, and a leading BOM.
 */
export class SseParser {
  private buffer = '';
  private data: string[] = [];
  private event: string | null = null;
  private lastId: string | null = null;
  private started = false;
  private pendingCr = false;

  feed(chunk: string): SseMessage[] {
    let text = chunk;
    if (!this.started && text.length > 0) {
      this.started = true;
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    }
    // A CR at the end of the previous chunk may be the first half of a CRLF.
    if (this.pendingCr && text.startsWith('\n')) text = text.slice(1);
    this.pendingCr = false;
    this.buffer += text;

    const out: SseMessage[] = [];
    let start = 0;
    for (let i = 0; i < this.buffer.length; i += 1) {
      const c = this.buffer.charCodeAt(i);
      if (c !== 10 && c !== 13) continue;
      const line = this.buffer.slice(start, i);
      if (c === 13) {
        if (i + 1 < this.buffer.length) {
          if (this.buffer.charCodeAt(i + 1) === 10) i += 1;
        } else {
          this.pendingCr = true;
        }
      }
      start = i + 1;
      const message = this.processLine(line);
      if (message) out.push(message);
    }
    this.buffer = this.buffer.slice(start);
    return out;
  }

  /** Call when the stream ends. Per the spec, an unterminated final message is discarded. */
  end(): { discardedPartial: boolean } {
    const discardedPartial = this.buffer.length > 0 || this.data.length > 0;
    this.buffer = '';
    this.data = [];
    this.event = null;
    return { discardedPartial };
  }

  private processLine(line: string): SseMessage | null {
    if (line === '') {
      if (this.data.length === 0) {
        this.event = null;
        return null;
      }
      const message: SseMessage = { id: this.lastId, event: this.event, data: this.data.join('\n') };
      this.data = [];
      this.event = null;
      return message;
    }
    if (line.startsWith(':')) return null;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    switch (field) {
      case 'data':
        this.data.push(value);
        break;
      case 'event':
        this.event = value;
        break;
      case 'id':
        if (!value.includes('\0')) this.lastId = value;
        break;
      default:
        break; // `retry` and unknown fields are ignored
    }
    return null;
  }
}
