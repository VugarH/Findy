import { cookies } from "next/headers";
import { PAGE_SIZE_COOKIE, withRememberedPageSize, type RawSearchParams } from "./filters";

/** URL params with the visitor's remembered "per page" choice filled in (server only). */
export async function withPageSizeCookie(params: RawSearchParams): Promise<RawSearchParams> {
  return withRememberedPageSize(params, (await cookies()).get(PAGE_SIZE_COOKIE)?.value);
}
