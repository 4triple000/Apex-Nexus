import { useState, useEffect } from "react";

export function useSession() {
  const [sessionId, setSessionId] = useState<string>("");

  useEffect(() => {
    let id = localStorage.getItem("apex_session_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("apex_session_id", id);
    }
    setSessionId(id);
  }, []);

  return sessionId;
}
