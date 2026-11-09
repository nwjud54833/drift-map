import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { SEO_METADATA } from "@/lib/seo/metadata";
import { OnboardingSurveyForm } from "@/components/driftmap/onboarding-survey-form";

export const metadata = SEO_METADATA.onboarding;

export default async function OnboardingPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/signin?callbackUrl=%2Fonboarding");

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { surveyCompleted: true } });
  if (!user) redirect("/signin?callbackUrl=%2Fonboarding");
  if (user.surveyCompleted) redirect("/workbench");

  return <OnboardingSurveyForm />;
}
