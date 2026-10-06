"use client";

import { useQuery } from "@tanstack/react-query";

import { getHealth } from "./api";

export interface HealthComponents {
  db: string;
  redis: string;
  llm: string;
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  components: HealthComponents;
}

export function useHealth() {
  return useQuery<HealthResponse>({
    queryKey: ["health"],
    queryFn: getHealth,
    staleTime: 30_000,
    retry: 0,
  });
}
