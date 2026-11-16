import { AuthForm } from "@/components/AuthForm";

export default async function Page({ searchParams }: PageProps<"/reset-password">) {
  const token = (await searchParams).token;
  return <AuthForm mode="reset" token={typeof token === "string" ? token : ""} />;
}
