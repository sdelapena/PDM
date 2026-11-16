import { T2View } from "@/components/T2View";
import { gate } from "@/lib/gate";

export default async function Page() {
  await gate((u) => u.type === "T2");
  return <T2View />;
}
