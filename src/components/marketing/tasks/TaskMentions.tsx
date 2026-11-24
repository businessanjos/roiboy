import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { ReactRenderer } from "@tiptap/react";
import Mention from "@tiptap/extension-mention";
import { PluginKey } from "@tiptap/pm/state";
import { exitSuggestion, type SuggestionProps } from "@tiptap/suggestion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface TaskMentionPerson { id: string; name: string; avatar_url: string | null }
const mentionKey = new PluginKey("marketing-task-mention");
const searchKey = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
export function matchingTaskMentionPeople(people: TaskMentionPerson[], query: string) {
  const key = searchKey(query);
  return [...new Map(people.map((person) => [person.id, person])).values()]
    .filter((person) => searchKey(person.name).split(/\s+/).some((name) => name.startsWith(key))).slice(0, 6);
}
interface MentionListHandle { onKeyDown: (event: KeyboardEvent) => boolean }
const TaskMentionList = forwardRef<MentionListHandle, SuggestionProps<TaskMentionPerson>>((props, ref) => {
  const [selected, setSelected] = useState(0);
  useEffect(() => setSelected(0), [props.items]);
  const choose = (index: number) => {
    const person = props.items[index];
    if (person) props.command({ id: person.id, label: person.name.trim().split(/\s+/)[0] });
  };
  useImperativeHandle(ref, () => ({ onKeyDown: (event) => {
    if (!props.items.length) return false;
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      setSelected((index) => (index + (event.key === "ArrowDown" ? 1 : -1) + props.items.length) % props.items.length);
      return true;
    }
    if (event.key === "Enter" || event.key === "Tab") { choose(selected); return true; }
    return false;
  } }));
  return <div role="listbox" aria-label="Pessoas para mencionar" className="max-h-56 w-64 max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain rounded-md border bg-popover p-1 text-popover-foreground shadow-lg">
    {!props.items.length && <p className="px-3 py-2 text-xs text-muted-foreground">Nenhuma pessoa encontrada.</p>}
    {props.items.map((person, index) => <Button key={person.id} type="button" variant="ghost" role="option" aria-selected={index === selected} aria-label={person.name} title={person.name}
      className={cn("h-auto min-h-11 w-full justify-start gap-2.5 rounded px-2 py-2", index === selected && "bg-accent text-accent-foreground")}
      onMouseDown={(event) => event.preventDefault()} onClick={() => choose(index)}>
      <Avatar className="h-7 w-7 shrink-0"><AvatarImage src={person.avatar_url ?? undefined} /><AvatarFallback className="bg-secondary text-xs text-secondary-foreground">{person.name.slice(0, 1).toUpperCase()}</AvatarFallback></Avatar>
      <span className="min-w-0 truncate text-sm">{person.name.trim().split(/\s+/)[0]}</span>
    </Button>)}
  </div>;
});
TaskMentionList.displayName = "TaskMentionList";

export function createTaskMentionExtension(getPeople: () => TaskMentionPerson[]) {
  return Mention.configure({
    HTMLAttributes: { class: "rounded bg-primary/10 px-0.5 font-medium text-primary" },
    renderText: ({ node }) => `@${node.attrs.label ?? ""}`,
    suggestion: {
      pluginKey: mentionKey, char: "@", container: '[role="dialog"]', placement: "top-start", floatingUi: { strategy: "absolute" },
      items: ({ query }) => matchingTaskMentionPeople(getPeople(), query),
      render: () => {
        let component: ReactRenderer<MentionListHandle> | null = null;
        let unmount: (() => void) | undefined;
        return {
          onStart: (props) => {
            component = new ReactRenderer(TaskMentionList, { props, editor: props.editor, className: "z-[80]" });
            unmount = props.mount(component.element);
          },
          onUpdate: (props) => component?.updateProps(props),
          onKeyDown: ({ event, view }) => {
            if (event.key === "Escape") { exitSuggestion(view, mentionKey); return true; }
            return component?.ref?.onKeyDown(event) ?? false;
          },
          onExit: () => { unmount?.(); component?.destroy(); component = null; },
        };
      },
    },
  });
}