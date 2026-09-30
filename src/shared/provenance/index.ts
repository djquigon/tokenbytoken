// Public surface of the label system. Minting (mint.ts) and reading (read.ts) are imported directly
// from their modules so lint can restrict who uses them.

export type { Kind, Prov, ProvOf, RecordedSource, RecordedVia, ReferenceSource, Sourced, ValueOf, KindOf } from './types';
export { METHODS, RULES, type MethodId, type RuleId } from './registry';
export { derive, deriveAll, illustrate, asWhatIf, type DerivedKind } from './combine';
export {
  KIND_LABEL,
  WHAT_IF_LABEL,
  WHAT_IF_LINE,
  GENERAL_REFERENCE_LINE,
  sourceLine,
  sourceDetail,
  recordedLine,
  rootSources,
} from './describe';
