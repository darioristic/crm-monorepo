import { cn } from "@/lib/utils";

interface SkeletonProps extends React.ComponentProps<"div"> {
  animate?: boolean;
}

function Skeleton({ className, animate = true, ...props }: SkeletonProps) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "relative overflow-hidden",
        "bg-gradient-to-r from-transparent via-primary/10 to-transparent dark:via-primary/10",
        "bg-[length:200%_100%]",
        "rounded-md",
        animate && "animate-shimmer",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
