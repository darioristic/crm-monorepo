import Image from "next/image";

type Props = {
  logo: string;
  customerName: string;
};

export function Logo({ logo, customerName }: Props) {
  return (
    <div className="max-w-[120px] max-h-[60px]">
      <Image
        src={logo}
        alt={customerName}
        width={120}
        height={60}
        style={{ objectFit: "contain", maxHeight: 60 }}
        unoptimized
      />
    </div>
  );
}
