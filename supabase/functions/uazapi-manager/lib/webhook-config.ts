import { uazapiAdminRequest, uazapiInstanceRequest } from "./uazapi-client.ts";

// Helper function to configure webhook automatically
// Updated for UAZAPI GO v2 compatibility with multiple endpoint/body formats
export async function configureWebhook(instanceToken: string, instanceName: string, supabaseUrl: string): Promise<boolean> {
  const webhookUrl = `${supabaseUrl}/functions/v1/uazapi-webhook`;
  console.log(`Configuring webhook for instance ${instanceName} to ${webhookUrl}`);
  
  // UAZAPI webhook body format - events in lowercase as per UAZAPI panel
  const webhookBody = {
    url: webhookUrl,
    enabled: true,
    webhookByEvents: true,
    addUrlEvents: false,
    addUrlTypesMessages: false,
    events: ["messages", "connection", "qrcode", "MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED", "chats", "groups", "history"]
  };
  
  // Alternative body format for UAZAPI GO v2
  const webhookBodyAlt = {
    webhook_url: webhookUrl,
    webhook_enabled: true,
    webhook_events: ["messages", "connection", "qrcode", "chats", "groups"]
  };
  
  // Nested settings format for some UAZAPI versions
  const webhookBodyNested = {
    webhook: {
      url: webhookUrl,
      enabled: true,
      events: ["messages", "connection", "qrcode", "chats", "groups"]
    }
  };
  
  // Try different endpoints and methods to set webhook
  const webhookEndpoints = [
    { url: `/instance/setWebhook`, method: "POST", body: webhookBody },
    { url: `/instance/setWebhook`, method: "POST", body: webhookBodyAlt },
    { url: `/instance/settings`, method: "POST", body: webhookBodyNested },
    { url: `/settings`, method: "POST", body: webhookBodyNested },
    { url: `/webhook/set`, method: "POST", body: webhookBody },
    { url: `/webhook`, method: "POST", body: webhookBody },
    { url: `/instance/webhook`, method: "POST", body: webhookBody },
    { url: `/settings/webhook`, method: "POST", body: webhookBody },
    { url: `/instance/setWebhook`, method: "PUT", body: webhookBody },
    { url: `/webhook/set`, method: "PUT", body: webhookBody },
    { url: `/webhook`, method: "PUT", body: webhookBody },
  ];
  
  for (const endpoint of webhookEndpoints) {
    try {
      console.log(`Trying webhook config: ${endpoint.method} ${endpoint.url}`);
      await uazapiInstanceRequest(endpoint.url, endpoint.method, instanceToken, endpoint.body);
      console.log(`Webhook configured successfully via ${endpoint.url}`);
      return true;
    } catch (err) {
      console.log(`Webhook ${endpoint.url} failed:`, (err as Error).message);
    }
  }
  
  // URL-encode instance name to handle spaces and special characters
  const encodedInstanceName = encodeURIComponent(instanceName);
  
  // Try admin endpoints as fallback
  const adminWebhookEndpoints = [
    { url: `/instance/setWebhook/${encodedInstanceName}`, method: "POST", body: webhookBody },
    { url: `/instance/setWebhook/${encodedInstanceName}`, method: "POST", body: webhookBodyAlt },
    { url: `/instance/webhook/${encodedInstanceName}`, method: "POST", body: webhookBody },
    { url: `/webhook/${encodedInstanceName}`, method: "POST", body: webhookBody },
    { url: `/instance/webhook/${encodedInstanceName}`, method: "PUT", body: webhookBody },
    { url: `/webhook/${encodedInstanceName}`, method: "PUT", body: webhookBody },
  ];
  
  for (const endpoint of adminWebhookEndpoints) {
    try {
      console.log(`Trying admin webhook config: ${endpoint.method} ${endpoint.url}`);
      await uazapiAdminRequest(endpoint.url, endpoint.method, endpoint.body);
      console.log(`Webhook configured successfully via admin ${endpoint.url}`);
      return true;
    } catch (err) {
      console.log(`Admin webhook ${endpoint.url} failed:`, (err as Error).message);
    }
  }
  
  console.log("Could not configure webhook automatically - manual configuration required");
  return false;
}
