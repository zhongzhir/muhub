"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** useActionState + Server Action 中 next/navigation 的 redirect() 在客户端常不可靠，改为返回 redirectPath 后由此完成跳转。 */
export function useRedirectFromActionState(redirectPath: string | undefined) {
  const router = useRouter();
  useEffect(() => {
    if (redirectPath) {
      router.push(redirectPath);
    }
  }, [redirectPath, router]);
}
