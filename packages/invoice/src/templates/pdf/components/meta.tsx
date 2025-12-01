import { Text, View } from "@react-pdf/renderer";
import { formatInvoiceDate } from "../../../utils/format";
import type { InvoiceTemplate } from "../../../types";

interface MetaProps {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  template: InvoiceTemplate;
}

export function Meta({ invoiceNumber, issueDate, dueDate, template }: MetaProps) {
  return (
    <View>
      <Text style={{ fontSize: 21, fontWeight: 500, marginBottom: 8 }}>
        {template.title}
      </Text>
      <View style={{ flexDirection: "column", gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={{ fontSize: 9, fontWeight: 500, marginRight: 2 }}>
            {template.invoiceNoLabel}:
          </Text>
          <Text style={{ fontSize: 9 }}>{invoiceNumber}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={{ fontSize: 9, fontWeight: 500, marginRight: 2 }}>
            {template.issueDateLabel}:
          </Text>
          <Text style={{ fontSize: 9 }}>
            {formatInvoiceDate(issueDate, template.dateFormat)}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={{ fontSize: 9, fontWeight: 500, marginRight: 2 }}>
            {template.dueDateLabel}:
          </Text>
          <Text style={{ fontSize: 9 }}>
            {formatInvoiceDate(dueDate, template.dateFormat)}
          </Text>
        </View>
      </View>
    </View>
  );
}
