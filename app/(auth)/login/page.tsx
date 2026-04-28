import { redirect } from "next/navigation";

// The app is single-user; auth was a placeholder. Send /login traffic into
// the onboarding flow so the path isn't a dead end.
export default function LoginPage() {
  redirect("/onboarding");
}
