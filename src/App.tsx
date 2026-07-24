import "./App.css";
import { renderingContextSettings, Screen } from './components/map/screen';
import { RefObject, useEffect, useRef, useState } from 'react';
import { Header } from "./components/header/header";
import { Entity } from "@engine/entities/entity";
import { IndustryComponent } from "@game/components/industryComponent";
import { ColoniesInforWindow } from "./components/coloniesInforWindow/coloniesInforWindow";
import { solarSystems, } from "@game/data/gameData";
import { Game } from "@game/game";
import { RedrawCommand } from "@/engine/lib/RedrawCommand";
import { ProductionBar } from "./components/productionBar/productionBar";
import { GameContext } from "./hooks/useGameContext";
import { useSelectionChanged } from "./hooks/useSelectionChanged";
import {
  MousemoveEvent,
  MousedownEvent,
  MouseupEvent,
  ClickEventData,
  MouseEventData,
} from "@/engine/lib/events";

function AppInner({ setCurrentColony, game, currentColony, sidebarCollapsed, setSidebarCollapsed, map }: {
  setCurrentColony: (entity: Entity | undefined) => void,
  game: Game | null,
  currentColony: Entity | undefined,
  sidebarCollapsed: boolean,
  setSidebarCollapsed: (value: boolean | ((prev: boolean) => boolean)) => void,
  map: RefObject<HTMLCanvasElement | null>
}) {
  useSelectionChanged(setCurrentColony)

  return <>
    <ColoniesInforWindow onAllocationChange={(colony, type, value) => {
      const industry = colony.getComponent(IndustryComponent)
      if(industry) {
        switch(type) {
          case "civilian":
            industry.civilianAllocation = value
            break
          case "military":
            industry.militaryAllocation = value
            break
        }
      }
    }} entity={currentColony} setIsOpen={(isOpen) => setCurrentColony(isOpen ? currentColony : undefined)} />
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
          onToggleCollapse={() => setSidebarCollapsed((prev: boolean) => !prev)}
        />
      </div>
      <div className="screenContainer flex-1 overflow-auto ">
        <Screen
          className="screenContainer"
          onMouseMove={(data) => {
            game?.engine.dispatchEvent(new MousemoveEvent(data as MouseEventData))
          }}
          onMouseDown={(data) => {
            game?.engine.dispatchEvent(new MousedownEvent(data as MouseEventData))
          }}
          onMouseUp={(data) => {
            const mouseData = data as unknown as { x: number; y: number; event: MouseEvent }
            game?.engine.dispatchEvent(new MouseupEvent({ name: "mouseup", data: { x: mouseData.x, y: mouseData.y, event: mouseData.event } }))
          }}
          triggerRedraw={() => game?.engine.addCommand(new RedrawCommand())}
          ref={map}
          onClick={(data) => {
            game?.engine.dispatchEvent(new ClickEventData(data as MouseEventData))
          }} />
      </div>
    </div >
  </>
}

function App() {
  const map = useRef<HTMLCanvasElement>(null);
  const [game, setGame] = useState<Game | null>(null)
  const [currentColony, setCurrentColony] = useState<Entity>()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    if(!map.current) return

    const gameInstance = new Game(map.current.getContext("2d", renderingContextSettings) as CanvasRenderingContext2D, solarSystems)

    setGame(gameInstance)

    return () => {
      gameInstance.destruct()
      setGame(null)
    }
  }, [])

  return <GameContext.Provider value={game?.engine ?? null}>
    <AppInner
      setCurrentColony={setCurrentColony}
      game={game}
      currentColony={currentColony}
      sidebarCollapsed={sidebarCollapsed}
      setSidebarCollapsed={setSidebarCollapsed}
      map={map}
    />
  </GameContext.Provider>
}

export default App
