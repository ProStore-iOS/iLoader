import { useCallback, useEffect, useRef, useState } from "react";
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
import { getVersion } from "@tauri-apps/api/app";
import { checkForUpdates } from "./update";
import logo from "./iloader.svg";
import { GlassCard } from "./components/GlassCard";

function App() {
  const [operationState, setOperationState] = useState<OperationState | null>(
    null
  );
  const [loggedInAs, setLoggedInAs] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<DeviceInfo | null>(null);
  const [openModal, setOpenModal] = useState<
    null | "certificates" | "appids" | "pairing"
  >(null);
  const [version, setVersion] = useState<string>("");
  const [revokeCert] = useStore<boolean>("revokeCert", true);
  const [platform, setPlatform] = useState<"mac" | "windows" | "linux">("windows");
  const refreshDevicesRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const fetchVersion = async () => {
      const version = await getVersion();
      setVersion(version);
    };
    fetchVersion();
  }, []);

  useEffect(() => {
    checkForUpdates();
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const ua = navigator.userAgent || "";
    if (ua.includes("Mac")) {
      setPlatform("mac");
    } else if (ua.includes("Win")) {
      setPlatform("windows");
    } else if (ua.includes("Linux")) {
      setPlatform("linux");
    }
  }, []);

  const shortcutLabel = useCallback(
    (mac: string, windows: string, linux?: string) => {
      if (platform === "mac") return mac;
      if (platform === "linux") return linux ?? windows;
      return windows;
    },
    [platform]
  );

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

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const primaryPressed =
        platform === "mac" ? event.metaKey : event.ctrlKey;
      if (!primaryPressed) return;

      if (!event.shiftKey && key === "p") {
        event.preventDefault();
        if (!ensureSelectedDevice()) return;
        setOpenModal("pairing");
      } else if (event.shiftKey && key === "c") {
        event.preventDefault();
        if (!ensuredLoggedIn()) return;
        setOpenModal("certificates");
      } else if (event.shiftKey && key === "a") {
        event.preventDefault();
        if (!ensuredLoggedIn()) return;
        setOpenModal("appids");
      } else if (!event.shiftKey && key === "r") {
        event.preventDefault();
        refreshDevicesRef.current?.();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [platform, ensureSelectedDevice, ensuredLoggedIn]);

  return (
    <main className="workspace">
      <header className="workspace-header">
        <div className="header-left">
          <div className="title-block">
            <img src={logo} alt="iloader logo" className="logo" />
            <div>
              <h1 className="title">iloader</h1>
              <p className="subtitle">Sideloading Companion</p>
            </div>
          </div>
          <span className="version-pill">Version {version}</span>
        </div>
        <div className="header-actions">
          <button
            className="toolbar-button"
            onClick={() =>
              window.open("https://github.com/nab138/iloader", "_blank", "noreferrer")
            }
          >
            GitHub
          </button>
        </div>
      </header>
      <div className="workspace-body">
        <aside className="workspace-sidebar">
          <section className="workspace-section">
            <div className="section-header">
              <p className="section-label">Account</p>
              <span className="section-hint placeholder" aria-hidden="true">
                Placeholder
              </span>
            </div>
            <GlassCard className="panel">
              <AppleID loggedInAs={loggedInAs} setLoggedInAs={setLoggedInAs} />
            </GlassCard>
          </section>
          <section className="workspace-section">
            <p className="section-label">Management</p>
            <div className="workspace-list">
              <button
                className="workspace-list-item"
                onClick={() => {
                  if (!ensureSelectedDevice()) return;
                  setOpenModal("pairing");
                }}
              >
                Manage Pairing File{" "}
                <span aria-hidden="true">
                  {shortcutLabel("⌘P", "Ctrl+P")}
                </span>
              </button>
              <button
                className="workspace-list-item"
                onClick={() => {
                  refreshDevicesRef.current?.();
                }}
              >
                Refresh Devices{" "}
                <span aria-hidden="true">
                  {shortcutLabel("⌘R", "Ctrl+R")}
                </span>
              </button>
              <button
                className="workspace-list-item"
                onClick={() => {
                  if (!ensuredLoggedIn()) return;
                  setOpenModal("certificates");
                }}
              >
                Certificates{" "}
                <span aria-hidden="true">
                  {shortcutLabel("⌘⇧C", "Ctrl+Shift+C")}
                </span>
              </button>
              <button
                className="workspace-list-item"
                onClick={() => {
                  if (!ensuredLoggedIn()) return;
                  setOpenModal("appids");
                }}
              >
                App IDs{" "}
                <span aria-hidden="true">
                  {shortcutLabel("⌘⇧A", "Ctrl+Shift+A")}
                </span>
              </button>
            </div>
          </section>
        </aside>
        <section className="workspace-content">
          <section className="workspace-section">
            <div className="section-header">
              <p className="section-label">Devices</p>
              <span className="section-hint">
                {selectedDevice ? `Active: ${selectedDevice.name}` : "Select a device"}
              </span>
            </div>
            <GlassCard className="panel">
              <Device
                selectedDevice={selectedDevice}
                setSelectedDevice={setSelectedDevice}
                registerRefresh={(fn) => {
                  refreshDevicesRef.current = fn ?? null;
                }}
              />
            </GlassCard>
          </section>
          <section className="workspace-section">
            <div className="section-header">
              <p className="section-label">Installers</p>
              <span className="section-hint">Choose a build</span>
            </div>
            <GlassCard className="panel">
              <div className="action-row single-row">
                <button
                  onClick={() => {
                    if (!ensuredLoggedIn() || !ensureSelectedDevice()) return;
                    startOperation(installSideStoreOperation, {
                      nightly: false,
                      liveContainer: false,
                      revokeCert,
                    });
                  }}
                >
                  SideStore (Stable)
                </button>
                <button
                  onClick={() => {
                    if (!ensuredLoggedIn() || !ensureSelectedDevice()) return;
                    startOperation(installSideStoreOperation, {
                      nightly: true,
                      revokeCert,
                      liveContainer: false,
                    });
                  }}
                >
                  SideStore (Nightly)
                </button>
                <button
                  onClick={() => {
                    if (!ensuredLoggedIn() || !ensureSelectedDevice()) return;
                    startOperation(installSideStoreOperation, {
                      nightly: false,
                      liveContainer: true,
                      revokeCert,
                    });
                  }}
                >
                  LiveContainer + SideStore (Stable)
                </button>
                <button
                  onClick={() => {
                    if (!ensuredLoggedIn() || !ensureSelectedDevice()) return;
                    startOperation(installSideStoreOperation, {
                      nightly: true,
                      liveContainer: true,
                      revokeCert,
                    });
                  }}
                >
                  LiveContainer + SideStore (Nightly)
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
                  Import IPA
                </button>
              </div>
            </GlassCard>
          </section>
          <section className="workspace-section">
            <p className="section-label">Settings</p>
            <GlassCard className="panel settings-panel">
              <Settings showHeading={false} />
            </GlassCard>
          </section>
          {operationState && (
            <section className="workspace-section">
              <p className="section-label">Activity</p>
              <GlassCard className="panel">
                <OperationView
                  operationState={operationState}
                  closeMenu={() => setOperationState(null)}
                />
              </GlassCard>
            </section>
          )}
        </section>
      </div>
      <Modal
        isOpen={openModal === "certificates"}
        close={() => setOpenModal(null)}
      >
        <Certificates />
      </Modal>
      <Modal isOpen={openModal === "appids"} close={() => setOpenModal(null)}>
        <AppIds />
      </Modal>
      <Modal isOpen={openModal === "pairing"} close={() => setOpenModal(null)}>
        <Pairing />
      </Modal>
    </main>
  );
}

export default App;
