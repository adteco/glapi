import { SignUp } from "@/lib/auth-compat.client";

export const metadata = {
  title: "Sign up - GLAPI",
  description: "Create your GLAPI account",
};

export default function SignUpPage() {
  return (
    <section className="flex min-h-svh items-center justify-center px-4 py-16 sm:px-6">
      <SignUp />
    </section>
  );
}
