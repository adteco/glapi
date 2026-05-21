import { SignUp } from "@/lib/auth-compat.client";

export default function SignUpPage() {
  return (
    <section className="relative bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="pt-32 pb-12 md:pt-40 md:pb-20">
          <div className="flex justify-center">
            <SignUp />
          </div>
        </div>
      </div>
    </section>
  );
}
