export type RssSource = {
  name: string;
  url: string;
  sourceType: string;
  /**
   * 标记该来源是否为中国地区媒体/平台。
   * 来自中国来源的条目在 china-affinity 检测时会自动命中
   * source_origin_china 信号，无需额外文本匹配。
   */
  isChinaSource?: boolean;
};
