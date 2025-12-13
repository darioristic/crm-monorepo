"use client";

import { AnimatePresence, motion, type Variants } from "framer-motion";
import React from "react";

type PresetType = "blur" | "fade-in-blur" | "scale" | "fade" | "slide";

type TextEffectProps = {
  children: string;
  per?: "word" | "char" | "line";
  as?: keyof React.JSX.IntrinsicElements;
  variants?: {
    container?: Variants;
    item?: Variants;
  };
  className?: string;
  preset?: PresetType;
  delay?: number;
  trigger?: boolean;
  onAnimationComplete?: () => void;
  segmentWrapperClassName?: string;
};

const defaultStaggerTimes: Record<"char" | "word" | "line", number> = {
  char: 0.03,
  word: 0.05,
  line: 0.1,
};

const defaultContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
  exit: {
    transition: { staggerChildren: 0.05, staggerDirection: -1 },
  },
};

const defaultItemVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
  },
  exit: { opacity: 0 },
};

const presetVariants: Record<PresetType, { container: Variants; item: Variants }> = {
  blur: {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0, filter: "blur(12px)" },
      visible: { opacity: 1, filter: "blur(0px)" },
      exit: { opacity: 0, filter: "blur(12px)" },
    },
  },
  "fade-in-blur": {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0, y: 20, filter: "blur(12px)" },
      visible: {
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
        transition: {
          type: "spring",
          stiffness: 100,
          damping: 15,
        },
      },
      exit: { opacity: 0, y: 20, filter: "blur(12px)" },
    },
  },
  scale: {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0, scale: 0 },
      visible: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 0 },
    },
  },
  fade: {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0 },
      visible: { opacity: 1 },
      exit: { opacity: 0 },
    },
  },
  slide: {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0, y: 20 },
      visible: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: 20 },
    },
  },
};

const AnimationComponent: React.FC<{
  segment: string;
  variants: Variants;
  per: "line" | "word" | "char";
  segmentWrapperClassName?: string;
}> = React.memo(({ segment, variants, per, segmentWrapperClassName }) => {
  const content =
    per === "line" ? (
      <motion.span variants={variants} className="block">
        {segment}
      </motion.span>
    ) : per === "word" ? (
      <motion.span aria-hidden="true" variants={variants} className="inline-block whitespace-pre">
        {segment}
      </motion.span>
    ) : (
      <motion.span className="inline-block whitespace-pre">
        {(() => {
          const charCounts = new Map<string, number>();
          return segment.split("").map((char) => {
            const count = charCounts.get(char) ?? 0;
            charCounts.set(char, count + 1);
            return (
              <motion.span
                key={`${char}-${count}`}
                aria-hidden="true"
                variants={variants}
                className="inline-block whitespace-pre"
              >
                {char}
              </motion.span>
            );
          });
        })()}
      </motion.span>
    );

  if (!segmentWrapperClassName) {
    return content;
  }

  const defaultWrapperClassName = per === "line" ? "block" : "inline-block";

  return <span className={`${defaultWrapperClassName} ${segmentWrapperClassName}`}>{content}</span>;
});

AnimationComponent.displayName = "AnimationComponent";

export function TextEffect({
  children,
  per = "word",
  as = "p",
  variants,
  className,
  preset = "fade",
  delay = 0,
  trigger = true,
  onAnimationComplete,
  segmentWrapperClassName,
}: TextEffectProps) {
  let segments: string[];

  if (per === "line") {
    segments = children.split("\n");
  } else if (per === "word") {
    segments = children.split(/(\s+)/);
  } else {
    segments = children.split("");
  }

  const MotionTag = motion[as as keyof typeof motion] as typeof motion.p;
  const selectedVariants = preset
    ? presetVariants[preset]
    : { container: defaultContainerVariants, item: defaultItemVariants };
  const containerVariants = variants?.container || selectedVariants.container;
  const itemVariants = variants?.item || selectedVariants.item;
  const stagger = defaultStaggerTimes[per];

  const delayedContainerVariants: Variants = {
    hidden: containerVariants.hidden,
    visible: {
      ...containerVariants.visible,
      transition: {
        ...(containerVariants.visible as { transition?: object }).transition,
        staggerChildren:
          (containerVariants.visible as { transition?: { staggerChildren?: number } }).transition
            ?.staggerChildren || stagger,
        delayChildren: delay,
      },
    },
    exit: containerVariants.exit,
  };

  return (
    <AnimatePresence mode="popLayout">
      {trigger && (
        <MotionTag
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={delayedContainerVariants}
          onAnimationComplete={onAnimationComplete}
          className={className}
        >
          {per !== "line" ? <span className="sr-only">{children}</span> : null}
          {(() => {
            const segmentCounts = new Map<string, number>();
            return segments.map((segment) => {
              const count = segmentCounts.get(segment) ?? 0;
              segmentCounts.set(segment, count + 1);
              return (
                <AnimationComponent
                  key={`${per}-${segment}-${count}`}
                  segment={segment}
                  variants={itemVariants}
                  per={per}
                  segmentWrapperClassName={segmentWrapperClassName}
                />
              );
            });
          })()}
        </MotionTag>
      )}
    </AnimatePresence>
  );
}
