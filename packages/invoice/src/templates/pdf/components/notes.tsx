import { Text, View } from "@react-pdf/renderer";

interface NotesProps {
  label: string;
  content: string | null;
}

export function Notes({ label, content }: NotesProps) {
  if (!content) return null;

  return (
    <View style={{ marginTop: 20 }}>
      <Text style={{ fontSize: 9, fontWeight: 500, marginBottom: 4 }}>{label}</Text>
      <Text style={{ fontSize: 9, lineHeight: 1.4, whiteSpace: "pre-wrap" }}>
        {content}
      </Text>
    </View>
  );
}

