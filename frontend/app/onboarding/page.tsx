import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { OnboardingSurveyForm } from "@/components/driftmap/onboarding-survey-form";

export const metadata: Metadata = {
  title: "Set up your DriftMap workspace",
  description: "Tell us a little about your API workflow to personalize DriftMap.",
};

export default async function OnboardingPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/signin?callbackUrl=%2Fonboarding");

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { surveyCompleted: true } });
  if (!user) redirect("/signin?callbackUrl=%2Fonboarding");
  if (user.surveyCompleted) redirect("/workbench");

  return <OnboardingSurveyForm />;
}
