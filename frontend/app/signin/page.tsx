import { AuthPage } from "@/components/auth/auth-page";
import { SEO_METADATA } from "@/lib/seo/metadata";

export const metadata = SEO_METADATA.signIn;

export default function SignInPage() { return <AuthPage mode="signin" />; }
