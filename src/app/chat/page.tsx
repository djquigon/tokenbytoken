import type { Metadata } from 'next';

import { ChatApp } from '@/components/chat/ChatApp';

export const metadata: Metadata = {
  title: 'Chat · Token by Token',
  description: 'Chat with a real AI model, then inspect every token of its reply.',
};

export default function ChatPage() {
  return <ChatApp />;
}
