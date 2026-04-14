import { SignIn } from "@clerk/nextjs";
import { clerkRedirects } from "@/lib/clerk-redirects";

export default function SignInPage() {
  return (
    <section className="relative bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="pt-32 pb-12 md:pt-40 md:pb-20">
          <div className="flex justify-center">
            <SignIn 
              fallbackRedirectUrl={clerkRedirects.signInFallbackRedirectUrl}
              appearance={{
                elements: {
                  rootBox: "mx-auto",
                  card: "bg-gray-800",
                  headerTitle: "text-white",
                  headerSubtitle: "text-gray-300",
                  socialButtonsBlockButton: "text-white",
                  formFieldLabel: "text-gray-300",
                  formFieldInput: "bg-gray-700 text-white",
                  footerActionLink: "text-purple-500 hover:text-purple-400",
                  formButtonPrimary: "bg-purple-600 hover:bg-purple-700",
                }
              }} 
            />
          </div>
        </div>
      </div>
    </section>
  );
}
