import { useState } from "react";
import "./App.css";
import { Modal } from "./components/Modal";
import { AppleID } from "./AppleID";
import { Device } from "./Device";
import { SideStore } from "./SideStore";
import { toast } from "sonner";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

function App() {
  const [openModal, setOpenModal] = useState<
    "sidestore" | "pairing" | "certificates" | "ids" | null
  >(null);

  return (
    <main className="container">
      <h1>iloader</h1>
      <div className="cards-container">
        <div className="card-dark">
          <AppleID />
        </div>
        <div className="card-dark">
          <Device />
        </div>
        <div className="card-dark buttons-container">
          <h2>Actions</h2>
          <div className="buttons">
            <button onClick={() => setOpenModal("sidestore")}>
              Install SideStore
            </button>
            <button
              onClick={async () => {
                let path = await open({
                  multiple: false,
                  filters: [{ name: "IPA Files", extensions: ["ipa"] }],
                });
                if (!path) return;
                toast.promise(invoke("sideload", { appPath: path as string }), {
                  loading: "Installing...",
                  success: "App installed successfully!",
                  error: (e) => {
                    console.error(e);
                    return e;
                  },
                });
              }}
            >
              Install Other
            </button>
            <button>Manage Pairing File</button>
            <button>Manage Certificates</button>
            <button>Manage App IDs</button>
          </div>
        </div>
      </div>
      <Modal
        isOpen={openModal === "sidestore"}
        pages={[<SideStore />]}
        close={() => setOpenModal(null)}
      />
    </main>
  );
}

export default App;
