import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Tables to backup with their critical columns
const BACKUP_TABLES = [
  "clients",
  "client_contracts",
  "client_products",
  "client_life_events",
  "client_diagnostics",
  "client_followups",
  "client_field_values",
  "client_subscriptions",
  "products",
  "events",
  "event_participants",
  "forms",
  "form_responses",
  "custom_fields",
  "client_stages",
  "users",
  "whatsapp_groups",
  "zapp_messages",
  "roi_events",
  "risk_events",
] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get account_id from request or backup all accounts (for cron)
    const { account_id } = await req.json().catch(() => ({}));

    let accountsToBackup: string[] = [];
    
    if (account_id) {
      accountsToBackup = [account_id];
    } else {
      // Backup all active accounts
      const { data: accounts, error: accountsError } = await supabase
        .from("accounts")
        .select("id")
        .in("subscription_status", ["active", "paid", "trial"]);
      
      if (accountsError) throw accountsError;
      accountsToBackup = accounts?.map(a => a.id) || [];
    }

    console.log(`Starting backup for ${accountsToBackup.length} accounts`);

    const results: Record<string, { success: boolean; tables: number; error?: string }> = {};

    for (const accId of accountsToBackup) {
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const backupData: Record<string, unknown[]> = {};

        // Export each table for this account
        for (const tableName of BACKUP_TABLES) {
          try {
            const { data, error } = await supabase
              .from(tableName)
              .select("*")
              .eq("account_id", accId)
              .limit(10000);

            if (error) {
              console.warn(`Error backing up ${tableName} for account ${accId}:`, error.message);
              backupData[tableName] = [];
            } else {
              backupData[tableName] = data || [];
            }
          } catch (tableError) {
            console.warn(`Table ${tableName} might not exist or have account_id:`, tableError);
            backupData[tableName] = [];
          }
        }

        // Also backup account and account_settings
        const { data: accountData } = await supabase
          .from("accounts")
          .select("*")
          .eq("id", accId)
          .single();
        
        const { data: settingsData } = await supabase
          .from("account_settings")
          .select("*")
          .eq("account_id", accId)
          .single();

        backupData["account"] = accountData ? [accountData] : [];
        backupData["account_settings"] = settingsData ? [settingsData] : [];

        // Create backup metadata
        const backupMetadata = {
          account_id: accId,
          created_at: new Date().toISOString(),
          tables_count: Object.keys(backupData).length,
          total_records: Object.values(backupData).reduce((sum, arr) => sum + arr.length, 0),
          version: "1.0",
        };

        const fullBackup = {
          metadata: backupMetadata,
          data: backupData,
        };

        // Upload to storage
        const fileName = `${accId}/backup-${timestamp}.json`;
        const fileContent = JSON.stringify(fullBackup, null, 2);

        const { error: uploadError } = await supabase.storage
          .from("backups")
          .upload(fileName, fileContent, {
            contentType: "application/json",
            upsert: false,
          });

        if (uploadError) {
          console.error(`Failed to upload backup for account ${accId}:`, uploadError);
          results[accId] = { success: false, tables: 0, error: uploadError.message };
        } else {
          console.log(`Backup created for account ${accId}: ${fileName}`);
          results[accId] = { 
            success: true, 
            tables: Object.keys(backupData).length,
          };

          // Cleanup old backups (keep last 30)
          await cleanupOldBackups(supabase, accId, 30);
        }
      } catch (accError) {
        console.error(`Error processing account ${accId}:`, accError);
        results[accId] = { success: false, tables: 0, error: String(accError) };
      }
    }

    const successCount = Object.values(results).filter(r => r.success).length;
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `Backup completed for ${successCount}/${accountsToBackup.length} accounts`,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Backup error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function cleanupOldBackups(
  supabase: any,
  accountId: string,
  keepCount: number
) {
  try {
    const { data: files, error } = await supabase.storage
      .from("backups")
      .list(accountId, {
        sortBy: { column: "created_at", order: "desc" },
      });

    if (error || !files) return;

    // Delete files beyond keepCount
    const filesToDelete = files.slice(keepCount);
    
    for (const file of filesToDelete) {
      await supabase.storage
        .from("backups")
        .remove([`${accountId}/${file.name}`]);
      
      console.log(`Deleted old backup: ${accountId}/${file.name}`);
    }
  } catch (error) {
    console.warn("Error cleaning up old backups:", error);
  }
}
