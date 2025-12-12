import { parseAsBoolean, parseAsString, useQueryStates } from "nuqs";

export function useCompanyParams() {
  const [params, setParams] = useQueryStates({
    companyId: parseAsString,
    createCompany: parseAsBoolean,
    name: parseAsString,
    q: parseAsString,
    details: parseAsBoolean,
  });

  return {
    ...params,
    setParams,
  };
}
