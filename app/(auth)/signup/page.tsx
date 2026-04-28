import { redirect } from "next/navigation";

// The app is single-user; auth was a placeholder. /signup → onboarding.
export default function SignupPage() {
  redirect("/onboarding");
}
