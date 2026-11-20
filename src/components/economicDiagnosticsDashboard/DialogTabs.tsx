"use client"

import { Tabs, TabsList, TabsContent } from "../ui/tabs"
import { ReactNode } from "react"

export function GameDialogTabs({
  triggers,
  children,
}: {
  triggers: ReactNode
  children: ReactNode
}) {
  return (
    <Tabs defaultValue="overview">
      <TabsList style={{ height: "2em", width: "100%" }}>
        {triggers}
      </TabsList>
      <div style={{
        height: "calc(75vh - 2em)",
        overflowY: "auto",
        padding: "1em",
      }}>
        {children}
      </div>
    </Tabs>
  )
}

type TabValue = "overview" | "markets" | "industries" | "households" | "treasury" | "cascades" | "history"

function TabPanel({ value, children }: { value: TabValue; children: ReactNode }) {
  return (
    <TabsContent style={{ overflowY: "auto" }} value={value}>
      {children}
    </TabsContent>
  )
}

export { TabPanel }
export type { TabValue }