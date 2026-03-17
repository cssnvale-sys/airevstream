import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AiRevStream — Content Automation',
  description: 'AI-powered multi-platform content automation system',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
