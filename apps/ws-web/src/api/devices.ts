const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:1488";

export interface DeviceImage {
  id: number;
  deviceId: string;
  source: string;
  url: string;
  position: number;
  isPrimary: boolean;
  createdAt: number;
  updatedAt: number;
}

export async function getDeviceImages(deviceId: string, source?: string): Promise<DeviceImage[]> {
  const params = source ? `?source=${encodeURIComponent(source)}` : "";
  const res = await fetch(`${API_BASE}/api/devices/${deviceId}/images${params}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Failed to fetch images: ${res.status}`);
  return res.json();
}

export async function setPrimaryImage(deviceId: string, imageId: number): Promise<DeviceImage[]> {
  const res = await fetch(`${API_BASE}/api/devices/${deviceId}/images/${imageId}/primary`, {
    method: "PUT",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Failed to set primary: ${res.status}`);
  return res.json();
}
