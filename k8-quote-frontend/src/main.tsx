import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AppWithProviders from './AppWithProviders.tsx'
import { AzureAuthProvider } from "./contexts/AzureAuthContext.tsx";

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <AzureAuthProvider>
            <AppWithProviders />
        </AzureAuthProvider>
    </StrictMode>,
);