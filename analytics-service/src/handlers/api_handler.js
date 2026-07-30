import { handleApiRequest } from "../controllers/analytics_controller.js";
import { createResponse } from "../utils/response.js";
import { logger } from "../utils/logger.js";

export const handler = async (event) => {
  logger.info("Received API event", { path: event.rawPath || event.path });

  try {
    const path = event.rawPath || event.path || (event.requestContext && event.requestContext.http && event.requestContext.http.path) || "";
    const method = event.requestContext?.http?.method || event.httpMethod || "";

    if (method === "OPTIONS") {
      return createResponse(200, { success: true });
    }

    if (path.endsWith("/health") && method === "GET") {
      return createResponse(200, { status: "ok" });
    }

    const data = await handleApiRequest(path, method);
    
    if (data !== null) {
      return createResponse(200, data);
    }

    return createResponse(404, { error: "Not Found" });
  } catch (error) {
    logger.error("API Handler Error", { error: error.message, stack: error.stack });
    return createResponse(500, { error: "Internal Server Error" });
  }
};
