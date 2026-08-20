import { SignIn } from "@/lib/auth-compat.client";

export const metadata = {
  title: "Sign in - GLAPI",
  description: "Sign in to your GLAPI account",
};

export default function SignInPage() {
  return (
    <section className="flex min-h-svh items-center justify-center px-4 py-16 sm:px-6">
      <SignIn />
    </section>
  );
}
