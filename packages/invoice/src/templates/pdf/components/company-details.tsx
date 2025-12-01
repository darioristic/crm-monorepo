import { Text, View } from "@react-pdf/renderer";
import type { CompanyDetails } from "../../../types";

interface CompanyDetailsBlockProps {
  label: string;
  company: CompanyDetails;
}

export function CompanyDetailsBlock({ label, company }: CompanyDetailsBlockProps) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ fontSize: 9, fontWeight: 500, marginBottom: 4 }}>{label}</Text>
      <View style={{ lineHeight: 1.4 }}>
        <Text style={{ fontSize: 9, fontWeight: 500 }}>{company.name}</Text>
        {company.address && (
          <Text style={{ fontSize: 9 }}>{company.address}</Text>
        )}
        {(company.city || company.country) && (
          <Text style={{ fontSize: 9 }}>
            {[company.city, company.country].filter(Boolean).join(", ")}
          </Text>
        )}
        {company.vatNumber && (
          <Text style={{ fontSize: 9 }}>VAT: {company.vatNumber}</Text>
        )}
        {company.phone && (
          <Text style={{ fontSize: 9 }}>Tel: {company.phone}</Text>
        )}
        {company.email && (
          <Text style={{ fontSize: 9 }}>{company.email}</Text>
        )}
        {company.website && (
          <Text style={{ fontSize: 9 }}>{company.website}</Text>
        )}
      </View>
    </View>
  );
}

