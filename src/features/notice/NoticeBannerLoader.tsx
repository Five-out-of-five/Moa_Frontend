import { NoticeBanner } from "./NoticeBanner";
import { getNoticeBanner } from "./server";

export async function NoticeBannerLoader() {
  const data = await getNoticeBanner().catch(() => null);
  return data ? <NoticeBanner {...data} /> : null;
}
