import { ColoniesInforWindow } from "./components/coloniesInforWindow/coloniesInforWindow";
import { Header } from "./components/header/header";
import { Screen } from "./components/map/screen";
import { ProductionBar } from "./components/productionBar/productionBar";
import { Game } from "./game/game";
import { CircularContextMenu } from "./components/ui/circularContextMenu";
import { SelectionChangedEvent } from "./engine/lib/events";

export function AppInner({ game, sidebarCollapsed, setSidebarCollapsed }: {
  game: Game | null;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (value: boolean | ((prev: boolean) => boolean)) => void;
}) {
  return <>
    <CircularContextMenu />
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
          onMouseMove={(data) => {
            game?.engine.dispatchEvent(data)
          }}
          onMouseDown={(data) => {
            game?.engine.dispatchEvent(data)
          }}
          onMouseUp={(data) => {
            game?.engine.dispatchEvent(data)
          }}
          onClick={(data) => {
            game?.engine.dispatchEvent(data)
            game?.engine.dispatchEvent(new SelectionChangedEvent({ type: "map", data: undefined }))
          }}
          onContextMenu={(data) => {
            game?.engine.dispatchEvent(data)
          }} />
      </div>
    </div>
  </>
}
