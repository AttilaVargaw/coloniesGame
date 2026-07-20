import "./App.css";
import { renderingContextSettings, Screen } from './components/map/screen';
import { useEffect, useRef, useState } from 'react';
import { Header } from "./components/header/header";
import { Entity } from "@engine/entities/entity";
import { ColoniesInforWindow } from "./components/coloniesInforWindow/coloniesInforWindow";
import { solarSystems, } from "@game/data/gameData";
import { Game } from "@game/game";
import { DateNode } from "@engine/systems/DateNode";

function App() {
  const map = useRef<HTMLCanvasElement>(null);
  const [game, setGame] = useState<Game | null>(null)
  const [currentColony, setCurrentColony] = useState<Entity>()
  const [date, setDate] = useState(0)

  useEffect(() => {
    if(!map.current) return

    const gameInstance = new Game(map.current.getContext("2d", renderingContextSettings) as CanvasRenderingContext2D, solarSystems)

    const updateDate = () => {
      setDate(gameInstance.engine.getNodeList(DateNode)[0].date.ms)
    }

    const onOpenInfoWindow = ({ data, type }: { data: Entity, type: "colony" }) => {
      switch(type) {
        case "colony":
          setCurrentColony(data)
          break
      }
    }

    const eventListener = (event: KeyboardEvent) => {
      gameInstance.engine?.dispatchEvent("keydown", { data: event })
    }

    const onMouseUp = (event: MouseEvent) => {
      const rect = map.current?.getBoundingClientRect()
      if(!rect) {
        return
      }
      gameInstance.engine?.dispatchEvent("mouseup", { name: "mouseup", data: { x: event.pageX - rect.left, y: event.pageY - rect.top, event } })
    }

    document.addEventListener("keydown", eventListener)
    window.addEventListener("mouseup", onMouseUp)
    gameInstance.engine?.subscribe("updateDone", updateDate as (data: unknown) => void)
      .subscribe("selectionChanged", onOpenInfoWindow as (data: unknown) => void)

    setGame(gameInstance)

    return () => {
      document.removeEventListener("keydown", eventListener)
      window.removeEventListener("mouseup", onMouseUp)

      gameInstance.engine.unsubscribe("updateDone", updateDate as (data: unknown) => void)
      gameInstance.engine.unsubscribe("selectionChanged", onOpenInfoWindow as (data: unknown) => void)

      gameInstance.destruct()

      setGame(null)
    }
  }, [])

  return (
    <>
      <ColoniesInforWindow entity={currentColony} setIsOpen={(isOpen) => setCurrentColony(isOpen ? currentColony : undefined)} />
      <Header time={date} />
      <Screen
        onMouseMove={(data) => {
          game?.engine.dispatchEvent("mouseMoved", data)
        }}
        onMouseDown={(data) => {
          game?.engine.dispatchEvent("mousedown", data)
        }}

        triggerRedraw={() => game?.engine.addCommand("redraw", {})}
        ref={map}
        onClick={(data) => {
          game?.engine.dispatchEvent("click", data)
        }} />
      {/* <div style={{ display: dynamicData ? "block" : "none" }}>
        <DataWindow header={dynamicDataHeader} data={dynamicData} />
      </div> */}
    </>
  );
}

export default App;
