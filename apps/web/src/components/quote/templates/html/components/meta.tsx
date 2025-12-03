import { format, parseISO } from "date-fns";
import type { QuoteTemplate } from "@/types/quote";

type Props = {
  template: QuoteTemplate;
  quoteNumber: string | null;
  issueDate?: string | null;
  validUntil?: string | null;
};

export function Meta({ template, quoteNumber, issueDate, validUntil }: Props) {
  if (!template) {
    return null;
  }

  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "";
    try {
      const date = parseISO(dateStr);
      return format(date, template.dateFormat || "dd.MM.yyyy");
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="mb-2">
      <h2 className="text-[21px] font-medium mb-1 w-fit min-w-[100px]">
        {template.title}
      </h2>
      <div className="flex flex-col gap-0.5">
        <div className="flex space-x-1 items-center">
          <div className="flex items-center flex-shrink-0 space-x-1">
            <span className="truncate text-[11px] text-[#878787]">
              {template.quoteNoLabel ? `${template.quoteNoLabel}:` : ""}
            </span>
            <span className="text-[11px] flex-shrink-0">{quoteNumber}</span>
          </div>
        </div>

        <div>
          <div>
            <div className="flex space-x-1 items-center">
              <div className="flex items-center flex-shrink-0 space-x-1">
                <span className="truncate text-[11px] text-[#878787]">
                  {template.issueDateLabel ? `${template.issueDateLabel}:` : ""}
                </span>
                <span className="text-[11px] flex-shrink-0">
                  {formatDate(issueDate)}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div>
          <div>
            <div className="flex space-x-1 items-center">
              <div className="flex items-center flex-shrink-0 space-x-1">
                <span className="truncate text-[11px] text-[#878787]">
                  {template.validUntilLabel ? `${template.validUntilLabel}:` : ""}
                </span>
                <span className="text-[11px] flex-shrink-0">
                  {formatDate(validUntil)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

