import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { CONTACT_CHANNELS } from "@/lib/tasks/contactChannels";

export interface ContactChannelOption {
  value: string;
  label: string;
  isCustom?: boolean;
}

export function slugifyChannel(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export function useContactChannels() {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const accountId = currentUser?.account_id;

  const { data: custom = [], isLoading } = useQuery({
    queryKey: ["contact-channels", accountId],
    enabled: !!accountId,
    queryFn: async (): Promise<ContactChannelOption[]> => {
      const { data, error } = await supabase
        .from("contact_channels")
        .select("value, label")
        .eq("account_id", accountId!)
        .eq("is_active", true)
        .order("label");
      if (error) throw error;
      return (data || []).map((c) => ({ value: c.value, label: c.label, isCustom: true }));
    },
  });

  const defaults: ContactChannelOption[] = CONTACT_CHANNELS.map((c) => ({
    value: c.value,
    label: c.label,
  }));

  const channels: ContactChannelOption[] = [
    ...defaults,
    ...custom.filter((c) => !defaults.some((d) => d.value === c.value)),
  ];

  const addChannel = async (rawLabel: string): Promise<ContactChannelOption> => {
    const label = rawLabel.trim();
    if (!label) throw new Error("Informe o nome da ferramenta.");
    if (!accountId) throw new Error("Conta não identificada.");

    const value = slugifyChannel(label) || `ferramenta_${Date.now()}`;
    const existing = channels.find(
      (c) => c.value === value || c.label.toLowerCase() === label.toLowerCase()
    );
    if (existing) return existing;

    const { data, error } = await supabase
      .from("contact_channels")
      .insert({
        account_id: accountId,
        value,
        label,
        created_by: currentUser?.id ?? null,
      })
      .select("value, label")
      .single();

    if (error) throw error;

    await queryClient.invalidateQueries({ queryKey: ["contact-channels", accountId] });
    return { value: data.value, label: data.label, isCustom: true };
  };

  return { channels, isLoading, addChannel };
}
