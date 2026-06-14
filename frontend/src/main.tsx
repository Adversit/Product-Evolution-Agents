import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { LiveProvider } from "./lib/live";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LiveProvider>
      <App />
    </LiveProvider>
  </React.StrictMode>,
);
