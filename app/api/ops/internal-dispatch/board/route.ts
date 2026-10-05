import { loadDispatchBoard } from "@/lib/server/dispatch-board-page";
import { opsApiError } from "@/lib/server/ops-request-context";
export async function GET(request: Request) {
  try {
    return Response.json(
      await loadDispatchBoard(
        Object.fromEntries(new URL(request.url).searchParams),
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return opsApiError(error);
  }
}
