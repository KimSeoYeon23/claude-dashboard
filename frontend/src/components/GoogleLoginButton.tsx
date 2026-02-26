import { useEffect, useRef, useState } from "react";
import axios from "axios";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (
            element: HTMLElement,
            config: { theme?: string; size?: string; width?: number; text?: string },
          ) => void;
        };
      };
    };
  }
}

interface Props {
  onSuccess: (credential: string) => void;
}

export default function GoogleLoginButton({ onSuccess }: Props) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    axios.get("/api/auth/google/client-id")
      .then(({ data }) => {
        if (data.client_id) setClientId(data.client_id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!clientId || !buttonRef.current) return;

    function render() {
      if (!window.google || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId!,
        callback: (response) => {
          onSuccess(response.credential);
        },
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: "outline",
        size: "large",
        width: 300,
        text: "signin_with",
      });
    }

    if (window.google) {
      render();
    } else {
      const interval = setInterval(() => {
        if (window.google) {
          clearInterval(interval);
          render();
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [clientId, onSuccess]);

  if (!clientId) return null;

  return <div ref={buttonRef} />;
}
