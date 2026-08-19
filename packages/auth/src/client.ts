import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

const baseURL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3031";

export const authClient = createAuthClient({
    baseURL,
    plugins: [
        organizationClient()
    ]
}) as ReturnType<typeof createAuthClient> & {
    organization: any;
    useActiveOrganization: any;
};

export const { 
    useSession, 
    useActiveOrganization, 
    signIn, 
    signOut, 
    signUp,
    organization
} = authClient as any;
