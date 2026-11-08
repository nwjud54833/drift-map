import type { ContractDirection } from "@/lib/contract/types";

export type ExampleDiffPresetId = "payment-webhook" | "order-fulfillment" | "openapi-upgrade";

export interface ExampleDiffPreset {
  id: ExampleDiffPresetId;
  name: string;
  direction: ContractDirection;
  baselineLabel: string;
  candidateLabel: string;
  baseline: string;
  candidate: string;
  yaml?: boolean;
}

export const EXAMPLE_DIFF_PRESETS: readonly ExampleDiffPreset[] = [
  {
    id: "payment-webhook",
    name: "Payment Webhook Drift",
    direction: "event",
    baselineLabel: "Payment webhook v1",
    candidateLabel: "Payment webhook v2",
    baseline: JSON.stringify({ id: "evt_2048", type: "payment.succeeded", data: { payment_id: "pay_91", total: 1299, currency: "USD" } }),
    candidate: JSON.stringify({ id: "evt_2048", type: "payment.succeeded", data: { payment_id: "pay_91", total: { amount: 1299, currency: "USD" } } }),
  },
  {
    id: "order-fulfillment",
    name: "Order Fulfillment API",
    direction: "response",
    baselineLabel: "Orders API v1",
    candidateLabel: "Orders API v2",
    baseline: JSON.stringify({ order_id: "ord_381", status: "shipped", delivery_date: "2026-11-09" }),
    candidate: JSON.stringify([
      { order_id: "ord_381", status: "shipped", delivery_date: null, tracking_metadata: { carrier: "DHL", url: "https://track.example/381" } },
      { order_id: "ord_382", status: "shipped", delivery_date: "2026-11-10" },
    ]),
  },
  {
    id: "openapi-upgrade",
    name: "OpenAPI 3.0 Spec Upgrade",
    direction: "response",
    baselineLabel: "Orders API OpenAPI 3.0.2",
    candidateLabel: "Orders API OpenAPI 3.0.3",
    yaml: true,
    baseline: `openapi: 3.0.2
info:
  title: Orders API
  version: 3.0.2
paths:
  /orders/{orderId}:
    get:
      operationId: getOrder
      parameters:
        - name: orderId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Order returned
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Order'
components:
  schemas:
    Order:
      type: object
      required: [orderId, status]
      properties:
        orderId:
          type: string
        status:
          type: string
          enum: [pending, shipped]
        totalCents:
          type: integer
`,
    candidate: `openapi: 3.0.3
info:
  title: Orders API
  version: 3.0.3
paths:
  /orders/{orderId}:
    get:
      operationId: getOrder
      parameters:
        - name: orderId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Order returned
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Order'
components:
  schemas:
    Order:
      type: object
      required: [orderId, status]
      properties:
        orderId:
          type: string
        status:
          type: string
          enum: [shipped, cancelled]
        totalCents:
          type: integer
        estimatedDelivery:
          type: string
          format: date
`,
  },
];

export function getExampleDiffPreset(id: ExampleDiffPresetId): ExampleDiffPreset {
  const preset = EXAMPLE_DIFF_PRESETS.find((item) => item.id === id);
  if (!preset) throw new Error("Unknown example diff preset.");
  return preset;
}
