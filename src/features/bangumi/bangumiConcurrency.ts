import { BANGUMI_MAX_CONCURRENT } from "./constants";

let bangumiMaxConcurrent = BANGUMI_MAX_CONCURRENT;

export function getBangumiMaxConcurrent() {
  return bangumiMaxConcurrent;
}

export function setBangumiMaxConcurrent(value: number) {
  bangumiMaxConcurrent = value;
}
