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
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8602E] focus-visible:ring-offset-2 focus-visible:ring-offset-black",
          "disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed",
          // Heights & Paddings
          size === "default" && "h-9 px-4 text-[13.5px]",
          size === "sm" && "h-8 px-3 text-[13px]",
          size === "lg" && "h-10 px-5 text-[14px] font-medium",
          size === "icon" && "h-8 w-8 p-0",
          // Primary Variant: DelTix Terracotta Orange
          variant === "primary" &&
            "bg-[#E8602E] !text-white font-medium hover:bg-[#d45222] active:bg-[#b8441b] border border-transparent shadow-sm [&_*]:!text-white",
          // Secondary Variant: Sheryians dark gradient button
          variant === "secondary" &&
            "border-[0.5px] border-[#4E4A48] bg-gradient-to-b from-[#171212] to-[#100B0B] hover:from-[#211A1A] hover:to-[#161010] text-[#E5E5E5] hover:text-white",
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
