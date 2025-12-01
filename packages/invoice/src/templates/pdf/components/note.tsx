import { Text, View } from "@react-pdf/renderer";

type Props = {
  content?: string | null;
  noteLabel?: string;
};

export function Note({ content, noteLabel }: Props) {
  if (!content) return null;

  return (
    <View style={{ marginTop: 24 }}>
      <Text style={{ fontSize: 10, fontWeight: 600, marginBottom: 6, color: "#374151" }}>
        {noteLabel}
      </Text>
      <View style={{ backgroundColor: "#fffbeb", padding: 12, borderRadius: 4, borderLeftWidth: 3, borderLeftColor: "#f59e0b" }}>
        {content.split("\n").map((line, index) => (
          <Text key={index} style={{ fontSize: 9, lineHeight: 1.5, color: "#92400e" }}>
            {line}
          </Text>
        ))}
      </View>
    </View>
  );
}

