import { Effect } from "effect";
import type { DataKind } from "@repo/scraper-domain";

export type { DataKind };
export type PipelineStage = "scrape" | "process_raw" | "process_ai";

export interface PipelineContext {
  jobId: string;
  deviceId: string | null;
  source: string;
  dataKind: DataKind;
  externalId: string;
  scrapeId: number | null;
  metadata?: Record<string, unknown>;
}

export type StageHandler<R = never, E = never> = (
  ctx: PipelineContext,
) => Effect.Effect<void, E, R>;

export interface PipelineDefinition<R = never, E = never> {
  source: string;
  dataKind: DataKind;
  stages: Partial<Record<PipelineStage, StageHandler<R, E>>>;
}

const pipelines = new Map<string, PipelineDefinition<unknown, unknown>>();

export const registerPipeline = <R, E>(def: PipelineDefinition<R, E>): void => {
  const key = `${def.source}:${def.dataKind}`;
  pipelines.set(key, def as PipelineDefinition<unknown, unknown>);
};

export const getPipeline = (
  source: string,
  dataKind: string,
): PipelineDefinition<unknown, unknown> | undefined => {
  return pipelines.get(`${source}:${dataKind}`);
};

export const getStageHandler = (
  source: string,
  dataKind: string,
  stage: PipelineStage,
): StageHandler<unknown, unknown> | undefined => {
  const pipeline = getPipeline(source, dataKind);
  return pipeline?.stages[stage];
};
