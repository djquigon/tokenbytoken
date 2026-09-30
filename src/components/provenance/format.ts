// Closed, meaning-preserving formatters for labeled values (docs/PLAN.md §3.5). A value can only be shown
// through one of these, via <Datum>.

import { visibleTokenText } from '@/shared/token-display';

export interface FormatValues {
  readonly int: number;
  readonly pct: number;
  readonly ms: number;
  readonly usd: number;
  readonly logprob: number;
  readonly rate: number;
  readonly text: string;
  readonly token: string;
  readonly bool: boolean;
  readonly id: string | number;
  readonly list: readonly (string | number)[];
  readonly json: unknown;
}

export type Format = keyof FormatValues;

const int = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export function formatValue<F extends Format>(format: F, value: FormatValues[F]): string {
  switch (format) {
    case 'int':
      return int.format(value as number);
    case 'pct': {
      // Never round up to a certainty that wasn't there: only an exact 100 reads "100%".
      const v = value as number;
      if (v === 0 || v === 100) return `${v}%`;
      if (v < 0.01) return '<0.01%';
      if (v > 99.99) return '>99.99%';
      if (v >= 99.5) return `${(Math.floor(v * 100) / 100).toFixed(2)}%`;
      return `${v.toFixed(v < 10 ? 2 : 1)}%`;
    }
    case 'ms': {
      const v = value as number;
      return v < 1_000 ? `${Math.round(v)} ms` : `${(v / 1_000).toFixed(2)} s`;
    }
    case 'usd': {
      const v = value as number;
      return v === 0 ? '$0' : v < 0.01 ? `$${v.toPrecision(2)}` : `$${v.toFixed(4)}`;
    }
    case 'logprob':
      return (value as number).toFixed(4);
    case 'rate':
      return `${(value as number).toFixed(1)} tokens/s`;
    case 'text':
      return value as string;
    case 'token':
      return visibleTokenText(value as string);
    case 'bool':
      return value ? 'yes' : 'no';
    case 'id':
      return String(value);
    case 'list': {
      const list = value as readonly (string | number)[];
      return list.length === 0 ? 'none' : list.join(', ');
    }
    case 'json':
      return JSON.stringify(value, null, 2);
    default:
      return String(value);
  }
}
