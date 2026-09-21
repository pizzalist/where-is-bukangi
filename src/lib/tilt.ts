import { useEffect, useState } from "react";

/**
 * 기울이기가 실제로 동작하는지 확인한다.
 * DeviceOrientation은 HTTPS가 필요하고, iOS는 사용자 제스처 안에서 권한을 받아야 하며,
 * iframe 안에서는 allow="gyroscope; accelerometer"가 없으면 이벤트가 아예 오지 않는다.
 * 그래서 "기울여보세요"는 이벤트가 실제로 도착했을 때만 안내한다.
 */
export function useTiltAvailable() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (typeof DeviceOrientationEvent === "undefined") return;
    const h = (e: DeviceOrientationEvent) => { if (e.gamma != null || e.beta != null) setOk(true); };
    addEventListener("deviceorientation", h);
    return () => removeEventListener("deviceorientation", h);
  }, []);
  return ok;
}
