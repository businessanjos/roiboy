import { Fragment, type ReactNode } from "react";
import type { JSONContent } from "@tiptap/react";
import { readTaskComment } from "@/lib/marketing/taskCommentContent";
import { markerInk, validMarkerColor } from "@/lib/marketing/taskDescription";

function renderNode(node: JSONContent): ReactNode {
  const children = node.content?.map((child, index) => <Fragment key={index}>{renderNode(child)}</Fragment>);
  switch (node.type) {
    case "doc": return children;
    case "paragraph": return <p className="min-h-5 [&+p]:mt-1.5">{children}</p>;
    case "bulletList": return <ul className="my-1 list-disc pl-5">{children}</ul>;
    case "orderedList": return <ol className="my-1 list-decimal pl-5">{children}</ol>;
    case "listItem": return <li>{children}</li>;
    case "hardBreak": return <br />;
    case "text": {
      let text: ReactNode = node.text;
      for (const mark of node.marks ?? []) {
        if (mark.type === "bold") text = <strong>{text}</strong>;
        if (mark.type === "italic") text = <em>{text}</em>;
        const color = mark.attrs?.color;
        if (mark.type === "highlight" && validMarkerColor(color)) {
          text = <mark className="rounded-sm" style={{ backgroundColor: color, color: markerInk(color) }}>{text}</mark>;
        }
      }
      return text;
    }
    default: return null;
  }
}

export function TaskCommentBody({ body }: { body: string }) {
  const content = readTaskComment(body);
  return <div className="whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]">
    {content.document ? renderNode(content.document) : content.text}
  </div>;
}