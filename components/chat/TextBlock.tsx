"use client";

import ReactMarkdown from "react-markdown";

export function TextBlock({ text }: { text: string }) {
  return (
    <div className="text-block markdown-body">
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );
}
