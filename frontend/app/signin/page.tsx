import type { Metadata } from "next";
import { AuthPage } from "@/components/auth/auth-page";

export const metadata: Metadata = { title: "Sign in · DriftMap", description: "Sign in to DriftMap with Google to access cloud workspaces." };

export default function SignInPage() { return <AuthPage mode="signin" />; }
