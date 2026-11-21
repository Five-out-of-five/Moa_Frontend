import "server-only";

import { getMyAccount } from "@/features/account/server";
import { getApiAccountContext } from "@/lib/api-account";
import { isMock } from "@/mocks/config";

export async function getReportViewerAccountId() {
  return isMock ? (await getMyAccount()).id : (await getApiAccountContext()).accountId;
}
