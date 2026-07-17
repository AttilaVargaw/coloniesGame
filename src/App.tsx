import "./App.css";
import { Screen } from './components/map/screen';
import { useEffect, useRef, useState } from 'react';
import { Engine } from './ems/engine';
import { Header } from "./components/header/header";
import { Entity } from "./ems/entities/entity";
import { ColoniesInforWindow } from "./components/coloniesInforWindow/coloniesInforWindow";
import { solarSystems, } from "./gameData";
import { Game, renderingContextSettings } from "./game";
import { DateNode } from "./ems/systems/DateNode";

function App() {
  const map = useRef<HTMLCanvasElement>(null);
  const [engine, setEngine] = useState<Engine | null>(null)
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

    document.addEventListener("keydown", eventListener)
    game.engine?.subscribe("updateDone", updateDate)
      .onCommand("openInfoWindow", onOpenInfoWindow)

    setEngine(game.engine)

    return () => {
      document.removeEventListener("keydown", eventListener)

      game.engine?.unsubscribe("updateDone", updateDate)
      //.unsubscribe("openInfoWindow", onOpenInfoWindow)

      setEngine(null)
    }
  }, [])

  return (
    <>
      <ColoniesInforWindow entity={currentColony} setIsOpen={(isOpen) => setCurrentColony(isOpen ? currentColony : undefined)} />
      <Header time={date} />
      <Screen
        onMouseMove={(data) => {
          engine?.addCommand({ name: "mouseMoved", data })
        }}
        engine={engine}
        ref={map}
        onClick={(data) => {
          engine?.addCommand({ name: "click", data })
        }} />
      {/* <div style={{ display: dynamicData ? "block" : "none" }}>
        <DataWindow header={dynamicDataHeader} data={dynamicData} />
      </div> */}
    </>
  );
}

export default App;
