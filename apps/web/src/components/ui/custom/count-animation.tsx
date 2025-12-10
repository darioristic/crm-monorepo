"use client";

import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

export default function CountAnimation({
  number,
  className,
}: {
  number: number;
  className?: string;
}) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, Math.round);

  useEffect(() => {
    const animation = animate(count, number, { duration: 2 });

    return animation.stop;
  }, [count, number]);

  return <motion.span className={cn(className)}>{rounded}</motion.span>;
}
