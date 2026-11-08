export interface EarlyAccessFormValues {
  email: string;
  githubOrg?: string;
  repositoryCount?: number;
}

export type EarlyAccessSubmitResult = { ok: true } | { ok: false; message: string };

export async function submitEarlyAccessRequest(
  values: EarlyAccessFormValues,
  fetchImpl: typeof fetch = fetch,
): Promise<EarlyAccessSubmitResult> {
  try {
    const response = await fetchImpl("/api/early-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: values.email,
        ...(values.githubOrg ? { githubOrg: values.githubOrg } : {}),
        ...(values.repositoryCount ? { repositoryCount: values.repositoryCount } : {}),
      }),
    });
    if (response.ok) return { ok: true };
    if (response.status === 429) return { ok: false, message: "Too many requests. Try again later." };
    if (response.status === 400) return { ok: false, message: "Enter a valid email and optional GitHub organization and repository count." };
    return { ok: false, message: "Early access requests are temporarily unavailable. Try again later." };
  } catch {
    return { ok: false, message: "Unable to send your request right now. Please try again." };
  }
}
