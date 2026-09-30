// Model output as sanitized Markdown (CLAUDE.md §10): no raw HTML, no images, and links that can't
// carry the reader's context along.

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

export function AssistantReply({ text }: { text: string }) {
  return (
    <div className="markdown" dir="auto">
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={components}
        skipHtml
        disallowedElements={['img']}
        unwrapDisallowed
        urlTransform={defaultUrlTransform}
      >
        {text}
      </Markdown>
    </div>
  );
}
