import { useEffect, useRef, useState } from "react";
import "./AppleID.css";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { load } from "@tauri-apps/plugin-store";
import { Modal } from "./components/Modal";
import { toast } from "sonner";
import { useStore } from "./StoreContext";

const store = await load("data.json");

export const AppleID = ({
  loggedInAs,
  setLoggedInAs,
}: {
  loggedInAs: string | null;
  setLoggedInAs: (id: string | null) => void;
}) => {
  const [storedIds, setStoredIds] = useState<string[]>([]);
  const [forceUpdateIds, setForceUpdateIds] = useState<number>(0);
  const [emailInput, setEmailInput] = useState<string>("");
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [saveCredentials, setSaveCredentials] = useState<boolean>(false);
  const [tfaOpen, setTfaOpen] = useState<boolean>(false);
  const [tfaCode, setTfaCode] = useState<string>("");
  const [addAccountOpen, setAddAccountOpen] = useState<boolean>(false);
  const [anisetteServer] = useStore<string>(
    "anisetteServer",
    "ani.sidestore.io"
  );

  useEffect(() => {
    let getLoggedInAs = async () => {
      let account = await invoke<string | null>("logged_in_as");
      setLoggedInAs(account);
    };
    let getStoredIds = async () => {
      let ids = (await store.get<string[]>("ids")) ?? [];
      setStoredIds(ids);
    };

    getLoggedInAs();
    getStoredIds();
  }, [forceUpdateIds]);

  const listenerAdded = useRef<boolean>(false);
  const unlisten = useRef<() => void>(() => {});

  useEffect(() => {
    if (!listenerAdded.current) {
      (async () => {
        const unlistenFn = await listen("2fa-required", () => {
          setTfaOpen(true);
        });
        unlisten.current = unlistenFn;
      })();
      listenerAdded.current = true;
    }
    return () => {
      unlisten.current();
    };
  }, []);

  return (
    <>
      <h2>Apple ID</h2>
      <div className="credentials-container">
        {loggedInAs && (
          <div className="logged-in-as card green">
            Logged in as: {loggedInAs}
            <div
              className="sign-out"
              onClick={async () => {
                let promise = async () => {
                  await invoke("invalidate_account");
                  setForceUpdateIds((v) => v + 1);
                };
                toast.promise(promise, {
                  loading: "Signing Out...",
                  error: (e) => `Sign out failed: ${e}`,
                  success: "Signed out successfully!",
                });
              }}
            >
              Sign Out
            </div>
          </div>
        )}
        {storedIds.length > 0 && (
          <div className="stored-ids">
            <h3>Saved Logins</h3>
            <div className="stored-container card">
              {storedIds.map((id) => (
                <div key={id} className="stored">
                  {id}
                  {!loggedInAs && (
                    <div
                      className="sign-out"
                      onClick={() => {
                        let promise = async () => {
                          await invoke("login_stored_pass", {
                            email: id,
                            anisetteServer,
                          });
                          setForceUpdateIds((v) => v + 1);
                        };
                        toast.promise(promise, {
                          loading: "Logging in...",
                          success: "Logged in successfully!",
                          error: (e) => `Login failed: ${e}`,
                        });
                      }}
                    >
                      Sign in
                    </div>
                  )}
                  <div
                    className="sign-out"
                    onClick={async () => {
                      let promise = async () => {
                        await invoke("delete_account", { email: id });
                        setForceUpdateIds((v) => v + 1);
                      };
                      toast.promise(promise, {
                        loading: "Deleting...",
                        error: (e) => `Deletion failed: ${e}`,
                        success: "Deleted successfully!",
                      });
                    }}
                  >
                    Delete
                  </div>
                </div>
              ))}
              {!addAccountOpen && (
                <div
                  className="stored add-account"
                  onClick={() => {
                    setAddAccountOpen(true);
                  }}
                >
                  Add Account +
                </div>
              )}
            </div>
          </div>
        )}
        {loggedInAs === null && (storedIds.length === 0 || addAccountOpen) && (
          <div className="new-login">
            {storedIds.length > 0 && <h3>New Login</h3>}
            <div className="credentials">
              <input
                type="email"
                placeholder="Apple ID Email..."
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
              />
              <input
                type="password"
                placeholder="Apple ID Password..."
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
              />
              <div className="save-credentials">
                <input
                  type="checkbox"
                  id="save-credentials"
                  checked={saveCredentials}
                  onChange={(e) => setSaveCredentials(e.target.checked)}
                />
                <label htmlFor="save-credentials">Save Credentials</label>
              </div>
              <button
                onClick={async () => {
                  let promise = async () => {
                    await invoke("login_email_pass", {
                      email: emailInput,
                      password: passwordInput,
                      saveCredentials: saveCredentials,
                      anisetteServer,
                    });
                    setForceUpdateIds((v) => v + 1);
                  };
                  toast.promise(promise, {
                    loading: "Logging in...",
                    success: "Logged in successfully!",
                    error: (e) => `Login failed: ${e}`,
                  });
                }}
              >
                Login
              </button>
              {addAccountOpen && storedIds.length > 0 && (
                <button
                  onClick={() => {
                    setAddAccountOpen(false);
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      <Modal sizeFit isOpen={tfaOpen}>
        <h2>Two-Factor Authentication</h2>
        <p>Please enter the verification code sent to your device.</p>
        <input
          type="text"
          placeholder="Verification Code..."
          value={tfaCode}
          onChange={(e) => setTfaCode(e.target.value)}
          style={{ marginRight: "0.5em" }}
        />
        <button
          onClick={async () => {
            if (tfaCode.length !== 6) {
              toast.warning("Please enter a valid 6-digit code.");
              return;
            }
            await emit("2fa-recieved", tfaCode);
            setTfaOpen(false);
            setTfaCode("");
          }}
        >
          Submit
        </button>
      </Modal>
    </>
  );
};
