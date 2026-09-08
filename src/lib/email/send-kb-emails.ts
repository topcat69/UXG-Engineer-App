import "server-only";
import { appBaseUrl } from "@/lib/app-url";
import { sendStandaloneEmail, type SendResult } from "./resend";
import { buildKbArticleSubmittedEmail } from "./templates";

/**
 * "KB article for review" — fanned out to every active manager/superadmin
 * by the caller (kb/actions.ts's submitArticle/resubmitArticle), same shape
 * as sendSubmittedEmail's fan-out for job QA: there's no single designated
 * reviewer for an article, so every manager+ gets one. Not job-scoped, so
 * a standalone send rather than a threaded one.
 */
export async function sendKbArticleSubmittedEmail(
  articleId: string,
  articleTitle: string,
  authorName: string,
  to: string,
  reviewerName: string,
): Promise<SendResult> {
  const content = buildKbArticleSubmittedEmail({
    articleTitle,
    authorName,
    reviewerName,
    deepLink: `${appBaseUrl()}/office/knowledge-base/${articleId}`,
  });
  return sendStandaloneEmail(to, content);
}
