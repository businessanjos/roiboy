import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { isPast, parseISO } from "date-fns";

export function usePendingTasksCount() {
  const { currentUser } = useCurrentUser();
  const [pendingCount, setPendingCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser?.id) {
      fetchTasksCount();
    }
  }, [currentUser?.id]);

  const fetchTasksCount = async () => {
    if (!currentUser?.id) return;
    setLoading(true);

    try {
      // 1. Find custom field of type "user"
      const { data: userFields } = await supabase
        .from("custom_fields")
        .select("id")
        .eq("field_type", "user")
        .eq("is_active", true);

      if (!userFields || userFields.length === 0) {
        setPendingCount(0);
        setOverdueCount(0);
        setLoading(false);
        return;
      }

      const userFieldIds = userFields.map(f => f.id);

      // 2. Find clients where current user is assigned
      const { data: fieldValues } = await supabase
        .from("client_field_values")
        .select("client_id, value_json")
        .in("field_id", userFieldIds);

      if (!fieldValues) {
        setPendingCount(0);
        setOverdueCount(0);
        setLoading(false);
        return;
      }

      // Filter to clients where current user is in the value_json array
      const myClientIds = fieldValues
        .filter(fv => {
          if (!fv.value_json) return false;
          const users = Array.isArray(fv.value_json) ? fv.value_json : [];
          return users.includes(currentUser.id);
        })
        .map(fv => fv.client_id);

      if (myClientIds.length === 0) {
        setPendingCount(0);
        setOverdueCount(0);
        setLoading(false);
        return;
      }

      // 3. Get products for these clients
      const { data: clientProducts } = await supabase
        .from("client_products")
        .select("client_id, product_id")
        .in("client_id", myClientIds);

      if (!clientProducts || clientProducts.length === 0) {
        setPendingCount(0);
        setOverdueCount(0);
        setLoading(false);
        return;
      }

      // Map client to products
      const clientProductMap = new Map<string, string[]>();
      clientProducts.forEach(cp => {
        const existing = clientProductMap.get(cp.client_id) || [];
        existing.push(cp.product_id);
        clientProductMap.set(cp.client_id, existing);
      });

      const allProductIds = [...new Set(clientProducts.map(cp => cp.product_id))];

      // 4. Get events linked to those products
      const { data: eventProducts } = await supabase
        .from("event_products")
        .select("event_id, product_id")
        .in("product_id", allProductIds);

      if (!eventProducts || eventProducts.length === 0) {
        setPendingCount(0);
        setOverdueCount(0);
        setLoading(false);
        return;
      }

      const eventIds = [...new Set(eventProducts.map(ep => ep.event_id))];

      // Map event to products
      const eventProductMap = new Map<string, string[]>();
      eventProducts.forEach(ep => {
        const existing = eventProductMap.get(ep.event_id) || [];
        existing.push(ep.product_id);
        eventProductMap.set(ep.event_id, existing);
      });

      // 5. Get events
      const { data: events } = await supabase
        .from("events")
        .select("id, scheduled_at")
        .in("id", eventIds);

      if (!events) {
        setPendingCount(0);
        setOverdueCount(0);
        setLoading(false);
        return;
      }

      // 6. Get deliveries for all clients
      const { data: deliveries } = await supabase
        .from("client_event_deliveries")
        .select("client_id, event_id, status")
        .in("client_id", myClientIds);

      const deliveryMap = new Map<string, string>();
      deliveries?.forEach(d => {
        deliveryMap.set(`${d.client_id}-${d.event_id}`, d.status);
      });

      // 7. Count tasks
      let pending = 0;
      let overdue = 0;

      myClientIds.forEach(clientId => {
        const clientProductIds = clientProductMap.get(clientId) || [];

        events.forEach(event => {
          const eventProductIds = eventProductMap.get(event.id) || [];
          const hasMatchingProduct = eventProductIds.some(pid => clientProductIds.includes(pid));

          if (hasMatchingProduct) {
            const deliveryKey = `${clientId}-${event.id}`;
            const status = deliveryMap.get(deliveryKey) || "pending";

            if (status !== "delivered") {
              pending++;
              if (event.scheduled_at && isPast(parseISO(event.scheduled_at))) {
                overdue++;
              }
            }
          }
        });
      });

      setPendingCount(pending);
      setOverdueCount(overdue);
    } catch (error) {
      console.error("Error fetching tasks count:", error);
      setPendingCount(0);
      setOverdueCount(0);
    } finally {
      setLoading(false);
    }
  };

  return { pendingCount, overdueCount, loading, refetch: fetchTasksCount };
}
