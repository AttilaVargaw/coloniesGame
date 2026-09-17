import "./App.css";
import { renderingContextSettings } from './components/map/screen';
import { useEffect, useRef, useState } from 'react';
import { MapCreationData } from "@game/data/gameData";
import { Game } from "@game/game";
import { GameContext } from "./hooks/useGameContext";
import { AppInner } from "./AppInner";

function App() {
  const mapRef = useRef<HTMLCanvasElement>(null);
  const [game, setGame] = useState<Game | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)

  useEffect(() => {
    if(!mapRef.current) {
      return
    }

    const gameInstance = new Game(mapRef.current.getContext("2d", renderingContextSettings) as CanvasRenderingContext2D, MapCreationData)

    setGame(gameInstance)

    return () => {
      gameInstance.destruct()
      setGame(null)
    }
  }, [])

  return <GameContext value={game?.engine ?? null}>
    <AppInner
      game={game}
      sidebarCollapsed={sidebarCollapsed}
      setSidebarCollapsed={setSidebarCollapsed}
      map={mapRef}
    />
  </GameContext>
}

export default App
