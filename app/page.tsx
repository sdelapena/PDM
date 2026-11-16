import { Board } from "@/components/Board";
import { gate } from "@/lib/gate";
import { canSeeBoard } from "@/lib/perm";

export default async function Home() {
  await gate(canSeeBoard);
  return <Board />;
}
