import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

import { EditorProvider } from "./context/EditorContext";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <EditorProvider>
      <App />
    </EditorProvider>
  </React.StrictMode>
);