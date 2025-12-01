import { Image, View } from "@react-pdf/renderer";

interface QRCodeProps {
  data: string;
  size?: number;
}

export function QRCode({ data, size = 60 }: QRCodeProps) {
  if (!data) return null;

  return (
    <View style={{ marginTop: 20 }}>
      <Image src={data} style={{ width: size, height: size }} />
    </View>
  );
}
