import { NoticeBanner } from "./NoticeBanner";
import { getNoticeBanner } from "./server";

export async function NoticeBannerLoader() {
  const data = await getNoticeBanner().catch((error: unknown) => {
    unstable_rethrow(error);
    return null;
  });
  return data ? <NoticeBanner {...data} /> : null;
}
import { unstable_rethrow } from "next/navigation";
