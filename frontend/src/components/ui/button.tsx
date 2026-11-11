import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "destructive" | "outline";
  size?: "default" | "sm" | "icon" | "lg";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "secondary", size = "default", disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-all duration-fast select-none rounded-btn active:scale-[0.98]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-9 focus-visible:ring-offset-2 focus-visible:ring-offset-app",
          "disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed",
          // Heights & Paddings
          size === "default" && "h-8 px-3.5 text-ui",
          size === "sm" && "h-7 px-2.5 text-ui-sm",
          size === "lg" && "h-10 px-5 text-ui font-semibold",
          size === "icon" && "h-8 w-8 p-0",
          // Primary Variant: Bulletproof high contrast (Black text on crisp white background)
          // Uses [&_*]:!text-black so nested elements (icons, Money, spans) CANNOT render white text
          variant === "primary" &&
            "bg-white !text-black font-semibold hover:bg-neutral-200 active:bg-neutral-300 border border-white/20 shadow-sm [&_*]:!text-black",
          // Secondary Variant: Neutral slate raised
          variant === "secondary" &&
            "bg-slate-3 text-slate-12 border border-slate-5 hover:bg-slate-4 hover:border-slate-7 active:bg-slate-5",
          // Ghost Variant
          variant === "ghost" &&
            "bg-transparent text-slate-11 hover:text-slate-12 hover:bg-slate-4 active:bg-slate-5",
          // Outline Variant
          variant === "outline" &&
            "bg-transparent border border-slate-5 text-slate-12 hover:bg-slate-3 hover:border-slate-7 active:bg-slate-4",
          // Destructive Variant: Solid red with crisp white text
          variant === "destructive" &&
            "bg-red-9 !text-white font-medium hover:bg-red-10 active:bg-red-8 border border-transparent shadow-sm [&_*]:!text-white",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
