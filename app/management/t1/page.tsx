import { CompanyManagement } from "@/components/Management";
import { gate } from "@/lib/gate";
import { isAdmin } from "@/lib/perm";

export default async function Page() {
  const me = await gate(isAdmin);
  return <CompanyManagement kind="T1" userName={me.name} />;
}
