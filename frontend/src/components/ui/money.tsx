import React from "react";
import { cn } from "@/lib/utils";

export interface MoneyProps {
  cents?: number;
  amount?: number; // In dollars/units if cents not supplied
  currency?: string;
  showCurrency?: boolean;
  align?: "left" | "right" | "center";
  className?: string;
  amountClassName?: string;
  secondaryCurrencyClassName?: string;
}

/**
 * Money component per DelTix Design Spec:
 * Uses font-variant-numeric: tabular-nums.
 * Displays formatted currency, sign, two decimal places, and secondary currency code.
 */
export function Money({
  cents,
  amount,
  currency = "USD",
  showCurrency = true,
  align = "right",
  className,
  amountClassName,
  secondaryCurrencyClassName,
}: MoneyProps) {
  const valueInDollars = cents !== undefined ? cents / 100 : amount ?? 0;
  const isNegative = valueInDollars < 0;
  const absValue = Math.abs(valueInDollars);

  // Format with strict two decimals and thousand commas
  const formattedNumber = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(absValue);

  const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : "";

  return (
    <span
      className={cn(
        "tabular-nums whitespace-nowrap inline-flex items-baseline",
        align === "right" && "justify-end",
        align === "left" && "justify-start",
        className
      )}
    >
      <span className={cn("font-medium", amountClassName)}>
        {isNegative ? "-" : ""}
        {symbol}
        {formattedNumber}
      </span>
      {showCurrency && (
        <span
          className={cn(
            "ml-1 opacity-70 text-[11px] font-normal tracking-wide",
            secondaryCurrencyClassName
          )}
        >
          {currency}
        </span>
      )}
    </span>
  );
}
