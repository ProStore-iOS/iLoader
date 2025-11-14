import "./Settings.css";
import { useStore } from "../StoreContext";
import { useEffect, useRef, useState } from "react";

type SettingsProps = {
  showHeading?: boolean;
};

let anisetteServers = [
  ["ani.sidestore.io", "SideStore (.io)"],
  ["ani.sidestore.app", "SideStore (.app)"],
  ["ani.sidestore.zip", "SideStore (.zip)"],
  ["ani.846969.xyz", "SideStore (.xyz)"],
  ["anisette.seasi.dev", "SeasiDev"],
  ["ani.xu30.top", "SteX"],
];
export const Settings = ({ showHeading = true }: SettingsProps) => {
  const [anisetteServer, setAnisetteServer] = useStore<string>(
    "anisetteServer",
    "ani.sidestore.io"
  );
  const [isCustom, setIsCustom] = useState<boolean>(
    anisetteServers.every(([value, _]) => value !== anisetteServer)
  );
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const customInputRef = useRef<HTMLInputElement | null>(null);
  const lastCustomValueRef = useRef<string>(
    anisetteServers.every(([value]) => value !== anisetteServer)
      ? anisetteServer
      : "ani.yourserver.com"
  );
  const anisetteLabelId = "anisette-label";

  useEffect(() => {
    if (!dropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [dropdownOpen]);

  useEffect(() => {
    if (isCustom) {
      lastCustomValueRef.current = anisetteServer;
      customInputRef.current?.focus();
    }
  }, [isCustom, anisetteServer]);

  const activateCustom = () => {
    setDropdownOpen(false);
    setIsCustom(true);
    setAnisetteServer(
      lastCustomValueRef.current || anisetteServer || "ani.yourserver.com"
    );
  };

  const deactivateCustom = () => {
    setDropdownOpen(false);
    setIsCustom(false);
    setAnisetteServer(anisetteServers[0][0]);
  };

  const customLabel =
    lastCustomValueRef.current && lastCustomValueRef.current.length > 0
      ? `Custom (${lastCustomValueRef.current})`
      : "Custom";
  const dropdownOptions = [...anisetteServers, ["custom", customLabel]];
  const selectedValue = isCustom ? "custom" : anisetteServer;
  const presetLabel =
    anisetteServers.find(([value]) => value === anisetteServer)?.[1] ??
    "Select Server";
  const selectedLabel = isCustom
    ? lastCustomValueRef.current || "Custom Anisette Server"
    : presetLabel;

  const [appIdDeletion, setAppIdDeletion] = useStore<boolean>(
    "allowAppIdDeletion",
    false
  );

  const [revokeCert, setRevokeCert] = useStore<boolean>("revokeCert", true);

  return (
    <>
      {showHeading && <h2>Settings</h2>}
      <div className="settings-container">
        <div>
          <label className="settings-label has-dropdown" id={anisetteLabelId}>
            <span>Anisette Server:</span>
            <div
              className={`custom-dropdown${dropdownOpen ? " open" : ""}`}
              ref={dropdownRef}
            >
              <button
                type="button"
                className="dropdown-toggle"
                aria-haspopup="listbox"
                aria-expanded={dropdownOpen}
                aria-labelledby={anisetteLabelId}
                onClick={() => setDropdownOpen((open) => !open)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown" || event.key === "Enter") {
                    event.preventDefault();
                    setDropdownOpen(true);
                  }
                }}
              >
                <span>{selectedLabel}</span>
                <span className="dropdown-caret" aria-hidden="true" />
              </button>
              {dropdownOpen && (
                <div
                  className="dropdown-menu"
                  role="listbox"
                  aria-labelledby={anisetteLabelId}
                >
                  {dropdownOptions.map(([value, label]) => {
                    const isSelected = selectedValue === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        role="option"
                        className={`dropdown-option${
                          isSelected ? " selected" : ""
                        }`}
                        aria-selected={isSelected}
                        onClick={() => {
                          if (value === "custom") {
                            activateCustom();
                          } else {
                            setIsCustom(false);
                            setAnisetteServer(value);
                            setDropdownOpen(false);
                          }
                        }}
                      >
                        <span>{label}</span>
                        {isSelected && (
                          <span className="checkmark" aria-hidden="true">
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </label>
          {!isCustom ? (
            <div className="custom-toggle">
              <button
                type="button"
                className="link-button"
                onClick={activateCustom}
              >
                Use custom Anisette server
              </button>
            </div>
          ) : (
            <div className="custom-toggle">
              <button
                type="button"
                className="link-button muted"
                onClick={deactivateCustom}
              >
                Back to preset servers
              </button>
            </div>
          )}
          {isCustom && (
            <input
              className="settings-label custom-anisette"
              type="text"
              placeholder="Custom Anisette Server"
              value={isCustom ? anisetteServer : ""}
              onChange={(e) => {
                setAnisetteServer(e.target.value);
              }}
              ref={customInputRef}
            />
          )}
        </div>
        <div>
          <label className="settings-label">
            Revoke Certificate after installing SideStore:
            <input
              type="checkbox"
              checked={revokeCert}
              onChange={(e) => {
                setRevokeCert(e.target.checked);
              }}
            />
          </label>
          <span className="settings-hint">
            You must refresh SideStore after installation if you enable this.
            This avoids the "You already have a current iOS Development
            certificate" error.
          </span>
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
