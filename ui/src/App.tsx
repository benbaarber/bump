import React, { useCallback } from "react";
import { createRoot } from "react-dom/client";
import Visualizer from "./animation/visualizer";

import "./style.css";

const App: React.FC = () => {
  const canvasMounted = useCallback((node: HTMLCanvasElement) => {
    if (!node) return;

    const v = new Visualizer(node);
    v.start();
  }, []);

  return (
    <div className="mono no-scrollbar h-screen w-screen bg-black">
      <canvas ref={canvasMounted} />
    </div>
  );
};

const root = createRoot(document.getElementById("root") as HTMLDivElement);
root.render(<App />);
