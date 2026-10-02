import type { Metadata } from 'next';

import sample from '../../../fixtures/sample/conversation.json';

import { ChatApp } from '@/components/chat/ChatApp';

export const metadata: Metadata = {
  title: 'Sample conversation',
  description: 'Replay a real recorded conversation with an AI model, token by token. Nothing is sent, and it costs nothing.',
};

export default function SamplePage() {
  return <ChatApp sample={{ conversation: sample.conversation }} />;
}
