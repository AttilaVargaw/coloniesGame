import "./App.css";
import { Screen } from './components/map/screen';
import { useEffect, useRef, useState } from 'react';
import { Header } from "./components/header/header";
import { Entity } from "./ems/entities/entity";
import { ColoniesInforWindow } from "./components/coloniesInforWindow/coloniesInforWindow";
import { solarSystems, } from "./gameData";
import { Game, renderingContextSettings } from "./game";
import { DateNode } from "./ems/systems/DateNode";

function App() {
  const map = useRef<HTMLCanvasElement>(null);
  const [game, setGame] = useState<Game | null>(null)
  const [currentColony, setCurrentColony] = useState<Entity>()
  const [date, setDate] = useState(0)

  useEffect(() => {
    if(!map.current) return

    const game = new Game(map.current.getContext("2d", renderingContextSettings)!, solarSystems)

    function updateDate() {
      setDate(game.engine.getNodeList(DateNode)?.[0].date.ms)
    }

    function onOpenInfoWindow({ data, type }: { data: Entity, type: "colony" }) {
      switch(type) {
        case "colony":
          setCurrentColony(data)
          break
      }
    }

    function eventListener(event: KeyboardEvent) {
      game.engine?.addCommand({ name: "keydown", data: event })
    }

    function onMouseUp(event: MouseEvent) {
      const rect = map.current?.getBoundingClientRect()
      if(!rect) return
      game.engine?.addCommand({ name: "mouseup", data: { x: event.pageX - rect.left, y: event.pageY - rect.top, event } })
    }

    document.addEventListener("keydown", eventListener)
    window.addEventListener("mouseup", onMouseUp)
    game.engine?.subscribe("updateDone", updateDate)
      .subscribe("selectionChanged", onOpenInfoWindow)

    setGame(game)

    return () => {
      document.removeEventListener("keydown", eventListener)
      window.removeEventListener("mouseup", onMouseUp)

      game.engine.unsubscribe("updateDone", updateDate)
      game.engine.unsubscribe("selectionChanged", onOpenInfoWindow)

      game.destruct()

      setGame(null)
    }
  }, [])

  return (
    <>
      <ColoniesInforWindow entity={currentColony} setIsOpen={(isOpen) => setCurrentColony(isOpen ? currentColony : undefined)} />
      <Header time={date} />
      <Screen
        onMouseMove={(data) => {
          game?.engine.addCommand({ name: "mouseMoved", data })
        }}
        onMouseDown={(data) => {
          game?.engine.addCommand({ name: "mousedown", data })
        }}
        onMouseUp={(data) => {
          game?.engine.addCommand({ name: "mouseup", data })
        }}
        triggerRedraw={() => game?.engine.addCommand({ name: "redraw", data: {} })}
        ref={map}
        onClick={(data) => {
          game?.engine.addCommand({ name: "click", data })
        }} />
      {/* <div style={{ display: dynamicData ? "block" : "none" }}>
        <DataWindow header={dynamicDataHeader} data={dynamicData} />
      </div> */}
    </>
  );
}

export default App;
