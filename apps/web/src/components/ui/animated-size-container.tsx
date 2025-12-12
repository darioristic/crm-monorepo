"use client";

import { motion } from "framer-motion";
import {
  type ComponentPropsWithoutRef,
  forwardRef,
  type PropsWithChildren,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

type AnimatedSizeContainerProps = PropsWithChildren<{
  width?: boolean;
  height?: boolean;
}> &
  Omit<ComponentPropsWithoutRef<typeof motion.div>, "animate" | "children">;

/**
 * A container with animated width and height (each optional) based on children dimensions.
 * Uses spring physics for smooth, natural animations.
 */
const AnimatedSizeContainer = forwardRef<HTMLDivElement, AnimatedSizeContainerProps>(
  ({ width = false, height = false, className, transition, children, ...rest }, forwardedRef) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState<{
      width: number | "auto";
      height: number | "auto";
    }>({
      width: "auto",
      height: "auto",
    });

    useEffect(() => {
      if (!containerRef.current) return;

      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry) {
          setDimensions({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          });
        }
      });

      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }, []);

    return (
      <motion.div
        ref={forwardedRef}
        className={cn("overflow-hidden", className)}
        animate={{
          width: width ? dimensions.width : "auto",
          height: height ? dimensions.height : "auto",
        }}
        transition={transition ?? { type: "spring", duration: 0.3 }}
        {...rest}
      >
        <div ref={containerRef} className={cn(height && "h-max", width && "w-max")}>
          {children}
        </div>
      </motion.div>
    );
  }
);

AnimatedSizeContainer.displayName = "AnimatedSizeContainer";

export { AnimatedSizeContainer };
