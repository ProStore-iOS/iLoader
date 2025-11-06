import "./Settings.css";
import { useStore } from "../StoreContext";
import { useState } from "react";

let anisetteServers = [
  ["ani.sidestore.io", "SideStore (.io)"],
  ["ani.sidestore.app", "SideStore (.app)"],
  ["ani.sidestore.zip", "SideStore (.zip)"],
  ["ani.846969.xyz", "SideStore (.xyz)"],
  ["anisette.seasi.dev", "SeasiDev"],
  ["ani.xu30.top", "SteX"],
];
export const Settings = () => {
  const [anisetteServer, setAnisetteServer] = useStore<string>(
    "anisetteServer",
    "ani.sidestore.io"
  );
  const [isCustom, setIsCustom] = useState<boolean>(
    anisetteServers.every(([value, _]) => value !== anisetteServer)
  );

  const [appIdDeletion, setAppIdDeletion] = useStore<boolean>(
    "allowAppIdDeletion",
    false
  );

  return (
    <>
      <h2>Settings</h2>
      <div className="settings-container">
        <div>
          <label className="settings-label">
            Anisette Server:
            <select
              value={isCustom ? "custom" : anisetteServer}
              onChange={(e) => {
                if (e.target.value !== "custom") {
                  setIsCustom(false);
                  setAnisetteServer(e.target.value);
                } else {
                  setIsCustom(true);
                  setAnisetteServer("ani.yourserver.com");
                }
              }}
            >
              {anisetteServers.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
              <option value="custom">Custom</option>
            </select>
          </label>
          {isCustom && (
            <input
              className="settings-label custom-anisette"
              type="text"
              placeholder="Custom Anisette Server"
              value={isCustom ? anisetteServer : ""}
              onChange={(e) => {
                setAnisetteServer(e.target.value);
              }}
            />
          )}
        </div>
        <div>
          <label className="settings-label">
            Allow App ID deletion:
            <input
              type="checkbox"
              checked={appIdDeletion}
              onChange={(e) => {
                setAppIdDeletion(e.target.checked);
              }}
            />
          </label>
          <span className="settings-hint">
            Not recommended for free dev accounts, this just hides them from the
            list. You still need to wait for them to expire to free up space.
          </span>
        </div>
      </div>
    </>
  );
};
