import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { taskTimestampRanges } from "@/lib/marketing/taskTimestamps";

export const TaskTimestampExtension = Extension.create({
  name: "taskTimestamps",
  addProseMirrorPlugins() {
    return [new Plugin({
      appendTransaction(transactions, _oldState, state) {
        if (!transactions.some((transaction) => transaction.docChanged)) return null;
        const bold = state.schema.marks.bold;
        if (!bold) return null;
        const transaction = state.tr;
        state.doc.descendants((node, position) => {
          if (!node.isTextblock) return;
          const text = node.textBetween(0, node.content.size, "\n", "\n");
          for (const range of taskTimestampRanges(text)) {
            const from = position + 1 + range.from;
            const to = position + 1 + range.to;
            state.doc.nodesBetween(from, to, (child, childPosition) => {
              if (child.isText && !bold.isInSet(child.marks)) {
                transaction.addMark(Math.max(from, childPosition), Math.min(to, childPosition + child.nodeSize), bold.create());
              }
            });
          }
          return false;
        });
        if (!transaction.docChanged) return null;
        // Automatic bold applies to the timestamp, not to what the user types next.
        transaction.setStoredMarks(state.storedMarks ?? state.selection.$from.marks());
        return transaction;
      },
    })];
  },
});