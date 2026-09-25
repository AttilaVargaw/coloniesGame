import { RefObject, } from "react";
import { ColoniesInforWindow } from "./components/coloniesInforWindow/coloniesInforWindow";
import { Header } from "./components/header/header";
import { Screen } from "./components/map/screen";
import { ProductionBar } from "./components/productionBar/productionBar";
import { MousemoveEvent, MouseEventData, MousedownEvent, MouseupEvent, ClickEventData } from "./engine/lib/events";
import { Game } from "./game/game";

export function AppInner({ game, sidebarCollapsed, setSidebarCollapsed, map }: {
  game: Game | null;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (value: boolean | ((prev: boolean) => boolean)) => void;
  map: RefObject<HTMLCanvasElement | null>;
}) {
  return <>
    <ColoniesInforWindow />
    <Header />
    <div className="flex bg-black">
      <div className={`transition-all duration-200 ${sidebarCollapsed ? "w-12" : "w-80"}`} style={{ position: "absolute", top: 54, bottom: 0, zIndex: 10 }}>
        <ProductionBar
          lines={[
            {
              name: "Main Orbital shipyard",
              queue: [
                { id: 1, name: "Heavy Cruiser", imageUrl: "", totalDays: 10, remainingDays: 5 },
                { id: 2, name: "Light Cruiser", imageUrl: "", totalDays: 10, remainingDays: 5 },
                { id: 3, name: "Destroyer", imageUrl: "", totalDays: 10, remainingDays: 5 },
              ]
            },
            {
              name: "Secondary Shipyard",
              queue: [
                { id: 4, name: "Frigate", imageUrl: "", totalDays: 5, remainingDays: 3 },
                { id: 5, name: "Scout", imageUrl: "", totalDays: 5, remainingDays: 3 },
              ]
            }
          ]}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((prev: boolean) => !prev)} />
      </div>
      <div className="screenContainer flex-1 overflow-auto">
        <Screen
          className="screenContainer"
          onMouseMove={(data) => {
            game?.engine.dispatchEvent(new MousemoveEvent(data as MouseEventData));
          }}
          onMouseDown={(data) => {
            game?.engine.dispatchEvent(new MousedownEvent(data as MouseEventData));
          }}
          onMouseUp={(data) => {
            game?.engine.dispatchEvent(new MouseupEvent(data as MouseEventData));
          }}
          ref={map}
          onClick={(data) => {
            game?.engine.dispatchEvent(new ClickEventData(data as MouseEventData));
          }} />
      </div>
    </div>
  </>;
}
