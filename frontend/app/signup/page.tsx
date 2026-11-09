import { AuthPage } from "@/components/auth/auth-page";
import { SEO_METADATA } from "@/lib/seo/metadata";

export const metadata = SEO_METADATA.signUp;

export default function SignUpPage() { return <AuthPage mode="signup" />; }
