import { redirect } from "next/navigation";

// Single-user app — there is no public signup. Send /signup to the login page.
export default function SignupPage() {
  redirect("/login");
}
