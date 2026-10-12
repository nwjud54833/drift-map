export type IsoDateString = string;
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject { [key: string]: JsonValue }
export type ContractDirection = "response" | "request" | "event";
export type SnapshotSource = "paste" | "file" | "fixture" | "workspace-import";
export type JsonKind = "string" | "number" | "boolean" | "null" | "object" | "array";
export type ExampleValue = JsonPrimitive | "[object]" | "[array]";
export type ChangeKind = "field-added" | "field-removed" | "type-changed" | "became-required" | "became-optional"
  | "endpoint-added" | "endpoint-removed" | "parameter-added" | "parameter-removed" | "parameter-changed"
  | "request-schema-changed" | "response-status-added" | "response-status-removed" | "response-schema-changed"
  | "property-added" | "property-removed" | "enum-changed" | "nullability-changed" | "format-changed"
  | "constraint-changed" | "requiredness-changed" | "additional-properties-changed" | "contract-format-changed";
export type ChangeSeverity = "breaking" | "warning" | "safe" | "info";
export interface Workspace { id: string; name: string; direction: ContractDirection; baselineSnapshotId: string | null; candidateSnapshotId: string | null; createdAt: IsoDateString; updatedAt: IsoDateString }
export interface PayloadSample { id: string; label: string; value: JsonObject; source: SnapshotSource; capturedAt: IsoDateString }
export interface ContractNode { pointer: string; label: string; kinds: JsonKind[]; presentInSamples: number; totalSamples: number; required: boolean; examples: ExampleValue[] }
export interface InferredContract { rootKinds: JsonKind[]; nodes: ContractNode[]; fingerprint: string; generatedAt: IsoDateString; inferenceVersion: 1 }
export interface OpenApiOperation { key: string; path: string; method: string; operationId: string | null; summary: string | null; parameters: JsonValue[]; requestBody: JsonValue | null; responses: Record<string, JsonValue> }
export interface OpenApiContract { kind: "openapi"; version: "3.0"; title: string; document: JsonValue; operations: OpenApiOperation[]; nodes: ContractNode[] }
export type StoredContract = InferredContract | OpenApiContract;
export type ImportArtifact = { format: "samples"; samples: PayloadSample[] } | { format: "openapi"; contract: OpenApiContract };
export interface ContractSnapshot { id: string; workspaceId: string; versionLabel: string; notes: string; sourceFileName: string | null; samples: PayloadSample[]; contract: StoredContract; createdAt: IsoDateString }
export interface ContractChange { id: string; pointer: string; kind: ChangeKind; severity: ChangeSeverity; title: string; explanation: string; before: ContractNode | null; after: ContractNode | null }
export interface DiffSummary { breaking: number; warning: number; safe: number; info: number; total: number }
export interface ContractDiff { baselineSnapshotId: string; candidateSnapshotId: string; direction: ContractDirection; generatedAt: IsoDateString; summary: DiffSummary; changes: ContractChange[] }
export interface ImportDraft { rawText: string; source: "paste" | "file"; fileName: string | null; versionLabel: string; parseError: string | null; previewSampleCount: number }
export interface WorkbenchFilters { query: string; severities: ChangeSeverity[]; showUnchanged: boolean }
export interface WorkspaceUIState { activeWorkspaceId: string | null; activePointer: string | null; focusedChangeId: string | null; isImportSheetOpen: boolean; isRawJsonDrawerOpen: boolean; isCommandPaletteOpen: boolean; filters: WorkbenchFilters; importDraft: ImportDraft }
