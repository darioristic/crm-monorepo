import { Text, View } from "@react-pdf/renderer";
import { format, parseISO } from "date-fns";

interface MetaProps {
  invoiceNo?: string | null;
  issueDate?: string | null;
  dueDate?: string | null;
  invoiceNoLabel: string;
  issueDateLabel: string;
  dueDateLabel: string;
  dateFormat?: string;
  timezone: string;
  title: string;
}

export function Meta({
  invoiceNo,
  issueDate,
  dueDate,
  invoiceNoLabel,
  issueDateLabel,
  dueDateLabel,
  dateFormat = "MM/dd/yyyy",
  timezone,
  title,
}: MetaProps) {
  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "";
    try {
      // Parse the ISO date and format it
      const date = parseISO(dateStr);
      return format(date, dateFormat);
    } catch {
      return dateStr;
    }
  };

  return (
    <View>
      <Text style={{ fontSize: 21, fontWeight: 500, marginBottom: 8 }}>
        {title}
      </Text>
      <View style={{ flexDirection: "column", gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={{ fontSize: 9, fontWeight: 500, marginRight: 2 }}>
            {invoiceNoLabel ? `${invoiceNoLabel}:` : ""}
          </Text>
          <Text style={{ fontSize: 9 }}>{invoiceNo}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={{ fontSize: 9, fontWeight: 500, marginRight: 2 }}>
            {issueDateLabel ? `${issueDateLabel}:` : ""}
          </Text>
          <Text style={{ fontSize: 9 }}>
            {formatDate(issueDate)}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={{ fontSize: 9, fontWeight: 500, marginRight: 2 }}>
            {dueDateLabel ? `${dueDateLabel}:` : ""}
          </Text>
          <Text style={{ fontSize: 9 }}>
            {formatDate(dueDate)}
          </Text>
        </View>
      </View>
    </View>
  );
}
