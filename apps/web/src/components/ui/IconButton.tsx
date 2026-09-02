"use client";

import { forwardRef } from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";

type IconButtonVariant = "solid" | "outline" | "ghost";
type IconButtonSize = "sm" | "md" | "lg";

interface IconButtonProps extends HTMLMotionProps<"button"> {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
}

const sizeClasses: Record<IconButtonSize, string> = {
  sm: "h-9 w-9",
  md: "h-11 w-11",
  lg: "h-14 w-14",
};

const variantClasses: Record<IconButtonVariant, string> = {
  solid:
    "bg-[var(--color-accent)] text-black hover:bg-[var(--color-accent-strong)]",
  outline:
    "border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-3)]",
  ghost:
    "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    { variant = "outline", size = "md", className = "", disabled, ...props },
    ref,
  ) => {
    const reduceMotion = useReducedMotion();

    return (
      <motion.button
        ref={ref}
        type="button"
        whileTap={disabled || reduceMotion ? undefined : { scale: 0.92 }}
        transition={{ duration: 0.15 }}
        disabled={disabled}
        className={`inline-flex shrink-0 items-center justify-center rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
        {...props}
      />
    );
  },
);

IconButton.displayName = "IconButton";