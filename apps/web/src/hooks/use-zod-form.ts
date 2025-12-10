import { zodResolver } from "@hookform/resolvers/zod";
import { type UseFormProps, useForm } from "react-hook-form";
import type { z } from "zod";

export const useZodForm = <T extends z.ZodType<unknown, z.ZodTypeDef, unknown>>(
  schema: T,
  options?: Omit<UseFormProps<z.infer<T>>, "resolver">
) => {
  return useForm<z.infer<T>>({
    resolver: zodResolver(schema),
    ...options,
  });
};
