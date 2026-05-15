/** 实训子域（training.muhub.cn）；本地可用 training.localhost */
export function isTrainingHost(host: string): boolean {
  const h = host.split(":")[0]?.toLowerCase() ?? "";
  return h === "training.localhost" || h.startsWith("training.");
}
