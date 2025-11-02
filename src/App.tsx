import { useState } from "react";
import "./App.css";
import { Modal } from "./Modal";
import { AppleID } from "./pages/AppleID";
import { Install } from "./pages/Install";

function App() {
  const [openModal, setOpenModal] = useState<
    "sidestore" | "pairing" | "other" | null
  >(null);

  return (
    <main className="container">
      <h1>iloader</h1>
      <div className="buttons">
        <button onClick={() => setOpenModal("sidestore")}>
          Install SideStore
        </button>
        <button onClick={() => setOpenModal("other")}>Install Other</button>
        <button>Manage Pairing File</button>
      </div>
      <Modal
        isOpen={openModal === "sidestore" || openModal === "other"}
        pages={[<AppleID />, <Install />]}
        close={() => setOpenModal(null)}
      />
    </main>
  );
}

export default App;
