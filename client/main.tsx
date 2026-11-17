import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router"

import "@/styles/base.css"
import "@/styles/shop.css"
import { Providers } from "@/app/providers"
import { router } from "@/app/router"
import { rootErrorHandlers, startMonitoring } from "@/monitoring"

void startMonitoring("shop-client")

createRoot(document.getElementById("root")!, rootErrorHandlers).render(
    <StrictMode>
        <Providers>
            <RouterProvider router={router} />
        </Providers>
    </StrictMode>
)
