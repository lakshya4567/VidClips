/**
 * VidClips - App Root
 */

import { useState } from "react";
import Editor from "./pages/Editor";
import LandingPage from "./pages/LandingPage";

export default function App() {
  const [showEditor, setShowEditor] = useState(false);

  if (showEditor) {
    return <Editor />;
  }

  return <LandingPage onLaunch={() => setShowEditor(true)} />;
}
