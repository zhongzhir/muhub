import type { InstitutionSourceConfig } from "@/lib/discovery/institution/institution-source";
import type { InstitutionParsedItem } from "@/lib/discovery/institution/types";

/** fetch 成功时的载体：HTML 正文 / 纯文本（预留 RSS、接口 JSON 等） */
export type InstitutionAdapterFetchOk = {
  ok: true;
  html?: string;
  text?: string;
  skippedFetch?: boolean;
  /** 实际请求的 URL（重定向后可用于审计） */
  fetchedUrl?: string;
  meta?: Record<string, unknown>;
};

export type InstitutionAdapterFetchResult =
  | InstitutionAdapterFetchOk
  | { ok: false; error: string };

/**
 * 机构来源适配器：match → fetch → parse，与具体官网实现解耦
 */
export type InstitutionAdapter = {
  readonly key: string;
  match(config: InstitutionSourceConfig): boolean;
  fetch(config: InstitutionSourceConfig): Promise<InstitutionAdapterFetchResult>;
  parse(ok: InstitutionAdapterFetchOk, config: InstitutionSourceConfig): InstitutionParsedItem[];
};
