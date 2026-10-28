import "./App.css";
import { StrictMode, useEffect, useState } from 'react';
import { MapCreationData } from "@game/data/gameData";
import { Game } from "@game/game";
import { GameContext } from "./hooks/useGameContext";
import { AppInner } from "./AppInner";

function App() {
  const [game, setGame] = useState<Game | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)

  useEffect(() => {
    if(!document.getElementById("2dCanvas")) {
      return
    }

    let gameInstance: Game | null = null

    Game.create(MapCreationData)
      .then(newGame => {
        gameInstance = newGame!
        setGame(newGame!)
      })
      .catch(console.error)

    return () => {
      gameInstance?.destruct()
      setGame(null)
    }
  }, [])

  return <StrictMode>
    <GameContext value={game?.engine ?? null}>
      <AppInner
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
      />
    </GameContext>
  </StrictMode>
}

export default App
