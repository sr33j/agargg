import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

// UI
import App from "./App.tsx";
import { PrivyProvider } from "@privy-io/react-auth";

// Utils
import { monadTestnet } from "./utils/chains";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <PrivyProvider
            appId={import.meta.env.VITE_PRIVY_APP_ID}
            config={{
                appearance: {
                    theme: "light",
                    walletChainType: "ethereum-only",
                },
                defaultChain: monadTestnet,
                supportedChains: [monadTestnet],
                loginMethods: ["wallet"],
                embeddedWallets: {
                    createOnLogin: 'all-users'
                },
            }}
        >
            <App />
        </PrivyProvider>
    </StrictMode>
);
