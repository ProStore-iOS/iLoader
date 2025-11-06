import "./Certificates.css";
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useStore } from "../StoreContext";

type AppId = {
  app_id_id: string;
  identifier: string;
  name: string;
  features: Record<string, any>;
  expiration_date: string | null;
};

type AppIdsResponse = {
  app_ids: AppId[];
  max_quantity: number;
  available_quantity: number;
};

export const AppIds = () => {
  const [appIds, setAppIds] = useState<AppId[]>([]);
  const [maxQuantity, setMaxQuantity] = useState<number | null>(null);
  const [availableQuantity, setAvailableQuantity] = useState<number | null>(
    null
  );
  const [loading, setLoading] = useState<boolean>(false);
  const loadingRef = useRef<boolean>(false);
  const [appIdDeletion] = useStore<boolean>("allowAppIdDeletion", false);

  const loadAppIds = useCallback(async () => {
    if (loadingRef.current) return;
    const promise = async () => {
      loadingRef.current = true;
      setLoading(true);
      let list = await invoke<AppIdsResponse>("list_app_ids");
      setAppIds(list.app_ids);
      setMaxQuantity(list.max_quantity);
      setAvailableQuantity(list.available_quantity);
      setLoading(false);
      loadingRef.current = false;
    };
    toast.promise(promise, {
      loading: "Loading App IDs...",
      success: "App IDs loaded successfully!",
      error: (e) => "Failed to load App IDs: " + e,
    });
  }, [setAppIds]);

  const deleteId = useCallback(
    async (id: string) => {
      const promise = invoke<void>("delete_app_id", {
        appIdId: id,
      });
      promise.then(loadAppIds);
      toast.promise(promise, {
        loading: "Deleting...",
        success: "App ID deleted successfully!",
        error: (e) => "Failed to delete App ID: " + e,
      });
    },
    [setAppIds, loadAppIds]
  );

  useEffect(() => {
    loadAppIds();
  }, []);

  return (
    <>
      <h2>Manage App IDs</h2>
      {maxQuantity !== null && (
        <div style={{ marginBottom: "0.5em" }}>
          {availableQuantity}/{maxQuantity} IDs Available
        </div>
      )}
      {appIds.length === 0 ? (
        <div>{loading ? "Loading App IDs..." : "No App IDs found."}</div>
      ) : (
        <div className="card">
          <div className="certificate-table-container">
            <table className="certificate-table">
              <thead>
                <tr className="certificate-item">
                  <th className="cert-item-part">Name</th>
                  <th className="cert-item-part">Expiration</th>
                  <th className="cert-item-part">ID</th>
                  <th
                    className="cert-item-part"
                    style={{
                      borderRight: appIdDeletion ? undefined : "none",
                    }}
                  >
                    Identifier
                  </th>
                  {appIdDeletion && <th>Delete</th>}
                </tr>
              </thead>
              <tbody>
                {appIds.map((appId, i) => (
                  <tr
                    key={appId.app_id_id}
                    className={
                      "certificate-item" +
                      (i === appIds.length - 1 ? " cert-item-last" : "")
                    }
                  >
                    <td className="cert-item-part">{appId.name}</td>
                    <td className="cert-item-part">
                      {appId.expiration_date
                        ? new Date(appId.expiration_date).toLocaleDateString()
                        : "Never"}
                    </td>
                    <td className="cert-item-part">{appId.app_id_id}</td>
                    <td
                      className="cert-item-part"
                      style={{
                        borderRight: appIdDeletion ? undefined : "none",
                      }}
                    >
                      {appId.identifier}
                    </td>
                    {appIdDeletion && (
                      <td
                        className="cert-item-revoke"
                        onClick={() => deleteId(appId.app_id_id)}
                      >
                        Delete
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <button
        style={{ marginTop: "1em" }}
        onClick={loadAppIds}
        disabled={loading}
      >
        Refresh
      </button>
    </>
  );
};
