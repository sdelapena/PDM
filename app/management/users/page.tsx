import { UserManagement } from "@/components/Management";
import { gate } from "@/lib/gate";
import { isAdmin } from "@/lib/perm";

export default async function Page() {
  const me = await gate(isAdmin);
  return <UserManagement userName={me.name} />;
}
