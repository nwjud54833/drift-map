import type { Metadata } from "next";
import { AuthPage } from "@/components/auth/auth-page";

export const metadata: Metadata = { title: "Get started · DriftMap", description: "Create your DriftMap account with Google and save cloud workspaces." };

export default function SignUpPage() { return <AuthPage mode="signup" />; }
