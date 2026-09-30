import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Token by Token',
  description: 'An interactive, honest look at how large language models generate a reply, token by token.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
