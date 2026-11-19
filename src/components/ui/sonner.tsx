import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group pointer-events-none"
      position="top-center"
      visibleToasts={2}
      gap={6}
      style={{ "--width": "300px" } as React.CSSProperties}
      toastOptions={{
        duration: 2000,
        classNames: {
          toast:
            "group toast pointer-events-none !min-h-0 !py-2 !px-3 !gap-2 !text-xs group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-md",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "pointer-events-auto group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          closeButton: "pointer-events-auto",
          cancelButton: "pointer-events-auto group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
