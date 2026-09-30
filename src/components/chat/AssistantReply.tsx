// Model output as sanitized Markdown (CLAUDE.md §10): no raw HTML, no images, and links that can't
// carry the reader's context along.

import { memo } from 'react';
import Markdown, { defaultUrlTransform, type Components } from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

const components: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow">
      {children}
    </a>
  ),
};

const REMARK = [remarkGfm];
const REHYPE = [rehypeSanitize];
const DISALLOWED = ['img'];

/** Memoized on the text: parsing Markdown is the costliest part of a chat re-render. */
export const AssistantReply = memo(function AssistantReply({ text }: { text: string }) {
  return (
    <div className="markdown" dir="auto">
      <Markdown
        remarkPlugins={REMARK}
        rehypePlugins={REHYPE}
        components={components}
        skipHtml
        disallowedElements={DISALLOWED}
        unwrapDisallowed
        urlTransform={defaultUrlTransform}
      >
        {text}
      </Markdown>
    </div>
  );
});
