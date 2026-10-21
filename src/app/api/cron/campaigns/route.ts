import { runCampaignBatch } from "@/lib/campaigns";
import { cronAuthorized } from "@/lib/cron";

export const maxDuration = 60;

/** Every 10 minutes: delivers the next batch of admin campaign messages. */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  const result = await runCampaignBatch(200);
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
