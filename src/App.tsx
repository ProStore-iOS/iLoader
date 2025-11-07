import { useCallback, useState } from "react";
import "./App.css";
import { AppleID } from "./AppleID";
import { Device, DeviceInfo } from "./Device";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  sideloadOperation,
  installSideStoreOperation,
  Operation,
  OperationState,
  OperationUpdate,
} from "./components/operations";
import { listen } from "@tauri-apps/api/event";
import OperationView from "./components/OperationView";
import { toast } from "sonner";
import { Modal } from "./components/Modal";
import { Certificates } from "./pages/Certificates";
import { AppIds } from "./pages/AppIds";
import { Settings } from "./pages/Settings";
import { Pairing } from "./pages/Pairing";
import { useStore } from "./StoreContext";

function App() {
  const [operationState, setOperationState] = useState<OperationState | null>(
    null
  );
  const [loggedInAs, setLoggedInAs] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<DeviceInfo | null>(null);
  const [openModal, setOpenModal] = useState<
    null | "certificates" | "appids" | "pairing" | "settings"
  >(null);

  const [revokeCert, setRevokeCert] = useStore<boolean>("revokeCert", true);

  const startOperation = useCallback(
    async (
      operation: Operation,
      params: { [key: string]: any }
    ): Promise<void> => {
      setOperationState({
        current: operation,
        started: [],
        failed: [],
        completed: [],
      });
      return new Promise<void>(async (resolve, reject) => {
        const unlistenFn = await listen<OperationUpdate>(
          "operation_" + operation.id,
          (event) => {
            setOperationState((old) => {
              if (old == null) return null;
              if (event.payload.updateType === "started") {
                return {
                  ...old,
                  started: [...old.started, event.payload.stepId],
                };
              } else if (event.payload.updateType === "finished") {
                return {
                  ...old,
                  completed: [...old.completed, event.payload.stepId],
                };
              } else if (event.payload.updateType === "failed") {
                return {
                  ...old,
                  failed: [
                    ...old.failed,
                    {
                      stepId: event.payload.stepId,
                      extraDetails: event.payload.extraDetails,
                    },
                  ],
                };
              }
              return old;
            });
          }
        );
        try {
          await invoke(operation.id + "_operation", params);
          unlistenFn();
          resolve();
        } catch (e) {
          unlistenFn();
          reject(e);
        }
      });
    },
    [setOperationState]
  );

  const ensuredLoggedIn = useCallback((): boolean => {
    if (loggedInAs) return true;
    toast.error("You must be logged in!");
    return false;
  }, [loggedInAs]);

  const ensureSelectedDevice = useCallback((): boolean => {
    if (selectedDevice) return true;
    toast.error("You must select a device!");
    return false;
  }, [selectedDevice]);

  return (
    <main className="container">
      <h1>iloader</h1>
      <div className="cards-container">
        <div className="card-dark">
          <AppleID loggedInAs={loggedInAs} setLoggedInAs={setLoggedInAs} />
        </div>
        <div className="card-dark">
          <Device
            selectedDevice={selectedDevice}
            setSelectedDevice={setSelectedDevice}
          />
        </div>
        <div className="card-dark buttons-container">
          <h2>Actions</h2>
          <div className="buttons">
            <button
              onClick={() => {
                if (!ensuredLoggedIn() || !ensureSelectedDevice()) return;
                startOperation(installSideStoreOperation, {
                  nightly: false,
                  revokeCert,
                });
              }}
            >
              Install SideStore (Stable)
            </button>
            <button
              onClick={() => {
                if (!ensuredLoggedIn() || !ensureSelectedDevice()) return;
                startOperation(installSideStoreOperation, {
                  nightly: true,
                  revokeCert,
                });
              }}
            >
              Install SideStore (Nightly)
            </button>
            <button
              onClick={async () => {
                if (!ensuredLoggedIn() || !ensureSelectedDevice()) return;
                let path = await open({
                  multiple: false,
                  filters: [{ name: "IPA Files", extensions: ["ipa"] }],
                });
                if (!path) return;
                startOperation(sideloadOperation, {
                  appPath: path as string,
                });
              }}
            >
              Install Other
            </button>
            <button
              onClick={() => {
                if (!ensureSelectedDevice()) return;
                setOpenModal("pairing");
              }}
            >
              Manage Pairing File
            </button>
            <button
              onClick={() => {
                if (!ensuredLoggedIn()) return;
                setOpenModal("certificates");
              }}
            >
              Manage Certificates
            </button>
            <button
              onClick={() => {
                if (!ensuredLoggedIn()) return;
                setOpenModal("appids");
              }}
            >
              Manage App IDs
            </button>
            <button
              onClick={() => {
                setOpenModal("settings");
              }}
            >
              Settings
            </button>
          </div>
        </div>
      </div>
      {operationState && (
        <OperationView
          operationState={operationState}
          closeMenu={() => setOperationState(null)}
        />
      )}
      <Modal
        isOpen={openModal === "certificates"}
        close={() => setOpenModal(null)}
      >
        <Certificates />
      </Modal>
      <Modal isOpen={openModal === "appids"} close={() => setOpenModal(null)}>
        <AppIds />
      </Modal>
      <Modal isOpen={openModal === "settings"} close={() => setOpenModal(null)}>
        <Settings />
      </Modal>
      <Modal isOpen={openModal === "pairing"} close={() => setOpenModal(null)}>
        <Pairing />
      </Modal>
    </main>
  );
}

export default App;
