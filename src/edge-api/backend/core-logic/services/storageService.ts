import type Env from "../env";
import type { PostRequestBody } from "../../lazy-imports/types";

export class StorageService {
  constructor(private env: Env) {}

  async loadRequestBody(codeSpace: string): Promise<PostRequestBody | null> {
    const bodyKey = `request_body_${codeSpace}`;
    try {
      const bodyObject = await this.env.R2.get(bodyKey);
      if (bodyObject) {
        const body = JSON.parse(await bodyObject.text()) as PostRequestBody;
        return body;
      }
    } catch (error) {
      console.error(`Failed to load request body from R2 (${bodyKey}):`, error);
    }
    return null;
  }

  async saveRequestBody(codeSpace: string, body: PostRequestBody): Promise<void> {
    const bodyKey = `request_body_${codeSpace}`;
    try {
      await this.env.R2.put(bodyKey, JSON.stringify(body));
    } catch (error) {
      console.error(`Failed to save request body to R2 (${bodyKey}):`, error);
      throw error;
    }
  }
}
