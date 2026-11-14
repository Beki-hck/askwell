import "server-only";
import type { ChatBusiness } from "@/components/chat/Chat";
import { localModelsAllowed, serverLlm } from "./llm";
import { getStore } from "./store";

/** What the chat widget needs to know about a business. Nothing private. */
export async function getChatProps(slug: string): Promise<{
  business: ChatBusiness;
  hasServerModel: boolean;
  allowLocal: boolean;
} | null> {
  const business = await (await getStore()).getBusiness(slug);
  if (!business) return null;
  return {
    business: {
      slug: business.slug,
      name: business.name,
      assistantName: business.assistantName,
      greeting: business.greeting,
      suggestions: business.suggestions,
      isDemo: business.isDemo,
    },
    hasServerModel: serverLlm() !== null,
    allowLocal: localModelsAllowed(),
  };
}
