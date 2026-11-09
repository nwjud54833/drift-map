export const LANDING_FAQ_ITEMS = [
  {
    question: "What does DriftMap do?",
    answer: "DriftMap is an API contract testing tool that compares JSON payload samples or OpenAPI 3.0 documents. It infers a contract from the inputs, compares a baseline with a candidate, and reports structural changes with compatibility classifications.",
  },
  {
    question: "What counts as breaking, warning, or safe?",
    answer: "For JSON samples, a change in inferred JSON type or a field changing from optional to required is breaking. A newly added required request field is breaking, while a newly added required response field is a warning. Optional additions are safe. A response field becoming nullable is a warning; request and event changes can receive different classifications.",
  },
  {
    question: "Does DriftMap keep my data local?",
    answer: "Local Workbench comparisons run in the browser and local workspace data is stored in IndexedDB. Cloud sync sends selected workspace snapshots to DriftMap. A local Share Review Link embeds compressed review data in its URL, so share it only with people allowed to see that data. Submitting the early-access or onboarding forms sends the fields you enter to DriftMap; Google sign-in sends authentication information to Google.",
  },
  {
    question: "How do I run DriftMap in CI?",
    answer: "Run `npx driftmap-cli diff main.json candidate.json` to compare two local files. In GitHub Actions, configure the DriftMap Action with baseline-path and candidate-path inputs, then set fail-on to breaking or warning to choose the CI failure threshold.",
  },
] as const;
