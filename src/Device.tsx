import { useCallback, useEffect, useRef, useState } from "react";
import "./Device.css";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

type DeviceInfo = {
  name: string;
  id: number;
  uuid: string;
};
export const Device = () => {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<DeviceInfo | null>(null);

  const listingDevices = useRef<boolean>(false);

  const selectDevice = useCallback(
    (device: DeviceInfo | null) => {
      setSelectedDevice(device);
      invoke("set_selected_device", { device }).catch((err) => {
        toast.error("Failed to select device" + err);
      });
    },
    [setSelectedDevice]
  );

  const loadDevices = useCallback(async () => {
    if (listingDevices.current) return;
    const promise = async () => {
      listingDevices.current = true;
      const devices = await invoke<DeviceInfo[]>("list_devices");
      setDevices(devices);
      selectDevice(devices.length > 0 ? devices[0] : null);
      listingDevices.current = false;
      return devices.length;
    };

    toast.promise(promise, {
      loading: "Loading devices...",
      success: (count) => {
        if (count === 0) {
          return "No devices found";
        }
        return `Found device${count > 1 ? "s" : ""}`;
      },
      error: "Failed to load devices",
    });
  }, [setDevices, selectDevice]);
  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  return (
    <>
      <h2>iDevice</h2>
      <div className="credentials-container">
        {devices.length === 0 && <p>No devices found.</p>}
        {devices.map((device) => (
          <div
            key={device.id}
            className={
              "device-card card" +
              (selectedDevice?.id === device.id ? " green" : "")
            }
          >
            {device.name}
            <div className="uuid">{device.uuid}</div>
            <div className="select-device" onClick={() => selectDevice(device)}>
              Select
            </div>
          </div>
        ))}
        <button onClick={loadDevices}>Refresh</button>
      </div>
    </>
  );
};
