// The "wireframe simulation" look for Example drawings (docs/PLAN.md §2): dashed outline, no glow, and an
// EXAMPLE tag that is real text, with the rule's disclaimer.

import type { ReactNode } from 'react';

import { RULES, type RuleId } from '@/shared/provenance';

export function ExampleFrame({ rule, children, className }: { rule: RuleId; children: ReactNode; className?: string }) {
  return (
    <figure className={`example-frame ${className ?? ''}`} data-kind="example" data-source={RULES[rule].label} data-detail={RULES[rule].disclaimer}>
      <span className="example-tag">Example</span>
      {children}
      <figcaption className="example-caption">{RULES[rule].disclaimer}</figcaption>
    </figure>
  );
}
