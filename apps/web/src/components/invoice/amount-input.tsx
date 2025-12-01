"use client";

import { cn } from "@/lib/utils";
import { productsApi } from "@/lib/api";
import { NumericFormat } from "react-number-format";
import { useState } from "react";
import { useController, useFormContext, useWatch } from "react-hook-form";
import type { FormValues } from "./form-context";

type Props = {
	name: string;
	className?: string;
	lineItemIndex?: number;
};

export function AmountInput({ name, className, lineItemIndex }: Props) {
	const [isFocused, setIsFocused] = useState(false);
	const { control, watch } = useFormContext<FormValues>();
	const {
		field: { value, onChange, onBlur },
	} = useController({
		name,
		control,
	});

	// Get current line item data for product-aware saving
	const lineItemName = lineItemIndex !== undefined 
		? watch(`lineItems.${lineItemIndex}.name`) 
		: undefined;
	const currentUnit = lineItemIndex !== undefined 
		? watch(`lineItems.${lineItemIndex}.unit`) 
		: undefined;
	const currentProductId = lineItemIndex !== undefined 
		? watch(`lineItems.${lineItemIndex}.productId`) 
		: undefined;
	const currency = useWatch({ control, name: "template.currency" });

	const isPlaceholder = !value && !isFocused;

	/**
	 * Save line item as product on blur (product-aware - like midday-main)
	 * Only saves if we have a productId (meaning this line item references an existing product)
	 */
	const handleAmountBlur = async () => {
		setIsFocused(false);
		onBlur();

		// Only save if we have a productId and valid name
		if (
			lineItemIndex !== undefined && 
			currentProductId && 
			lineItemName && 
			lineItemName.trim().length > 0
		) {
			try {
				await productsApi.saveLineItemAsProduct({
					name: lineItemName.trim(),
					price: value !== undefined ? value : null,
					unit: currentUnit || null,
					productId: currentProductId,
					currency: currency || null,
				});
			} catch (error) {
				console.error("Failed to save product:", error);
			}
		}
	};

	return (
		<div className="relative font-mono">
			<NumericFormat
				autoComplete="off"
				value={value}
				onValueChange={(values) => {
					onChange(
						values.floatValue !== undefined && values.floatValue !== null
							? values.floatValue
							: 0,
						{ shouldValidate: true }
					);
				}}
				onFocus={() => setIsFocused(true)}
				onBlur={handleAmountBlur}
				className={cn(
					className,
					isPlaceholder && "opacity-0",
					"p-0 border-0 h-6 text-xs !bg-transparent border-b border-transparent focus:border-border outline-none"
				)}
				thousandSeparator={true}
				decimalScale={2}
			/>

			{isPlaceholder && (
				<div className="absolute inset-0 pointer-events-none">
					<div className="h-full w-full bg-[repeating-linear-gradient(-60deg,#DBDBDB,#DBDBDB_1px,transparent_1px,transparent_5px)] dark:bg-[repeating-linear-gradient(-60deg,#2C2C2C,#2C2C2C_1px,transparent_1px,transparent_5px)]" />
				</div>
			)}
		</div>
	);
}
